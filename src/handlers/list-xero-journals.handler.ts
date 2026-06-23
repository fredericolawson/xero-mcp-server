import { xeroClient } from "../clients/xero-client.js";
import { Journal } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

// The Journals endpoint returns at most 100 journals per call and has no
// server-side date or account filter — you page through the whole ledger via
// `offset` (the highest JournalNumber seen so far). MAX_PAGES is a safety cap
// so a huge ledger can't spin forever; hitting it is surfaced to the caller.
const JOURNALS_PER_PAGE = 100;
const MAX_PAGES = 100; // up to 10,000 journals

export interface ListJournalsOptions {
  paymentsOnly?: boolean;
  fromDate?: string;
  toDate?: string;
  accountCodes?: string[];
}

export interface ListJournalsResult {
  journals: Journal[];
  truncated: boolean;
}

function isWithinDateRange(
  journalDate: string | undefined,
  fromDate?: string,
  toDate?: string,
): boolean {
  if (!fromDate && !toDate) return true;
  if (!journalDate) return true;

  const date = new Date(journalDate);
  if (Number.isNaN(date.getTime())) return true; // unparseable — don't exclude

  if (fromDate) {
    const from = new Date(fromDate);
    if (!Number.isNaN(from.getTime()) && date < from) return false;
  }
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999); // inclusive of the whole end day
      if (date > to) return false;
    }
  }
  return true;
}

async function fetchAllJournals(
  paymentsOnly?: boolean,
): Promise<{ journals: Journal[]; truncated: boolean }> {
  await xeroClient.authenticate();

  const journals: Journal[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await xeroClient.accountingApi.getJournals(
      xeroClient.tenantId,
      undefined, // ifModifiedSince
      offset, // offset
      paymentsOnly ?? false, // paymentsOnly
      getClientHeaders(),
    );

    const batch = response.body.journals ?? [];
    journals.push(...batch);

    if (batch.length < JOURNALS_PER_PAGE) {
      return { journals, truncated: false };
    }

    // Next page starts after the highest journal number in this batch.
    offset = batch.reduce(
      (max, journal) => Math.max(max, journal.journalNumber ?? 0),
      offset,
    );
  }

  return { journals, truncated: true };
}

/**
 * List general-ledger journals from Xero — the double-entry postings behind
 * every transaction, which the P&L and Balance Sheet are built from. The whole
 * ledger is fetched and paginated automatically; date range and account-code
 * filters are applied client-side (the endpoint supports neither server-side).
 */
export async function listXeroJournals(
  options: ListJournalsOptions = {},
): Promise<XeroClientResponse<ListJournalsResult>> {
  try {
    const { paymentsOnly, fromDate, toDate, accountCodes } = options;
    const { journals, truncated } = await fetchAllJournals(paymentsOnly);

    const codeFilter =
      accountCodes && accountCodes.length > 0
        ? new Set(accountCodes.map((code) => code.toLowerCase()))
        : null;

    const filtered = journals
      .filter((journal) =>
        isWithinDateRange(journal.journalDate, fromDate, toDate),
      )
      .map((journal): Journal => {
        if (!codeFilter) return journal;
        // Keep only the lines posted to the requested accounts.
        const journalLines = (journal.journalLines ?? []).filter(
          (line) =>
            line.accountCode && codeFilter.has(line.accountCode.toLowerCase()),
        );
        return { ...journal, journalLines };
      })
      .filter((journal) => (journal.journalLines?.length ?? 0) > 0);

    return {
      result: { journals: filtered, truncated },
      isError: false,
      error: null,
    };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
