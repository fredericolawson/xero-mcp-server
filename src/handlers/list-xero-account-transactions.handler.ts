import { xeroClient } from "../clients/xero-client.js";
import {
  Invoice,
  BankTransaction,
  CreditNote,
  ManualJournal,
  LineItem,
} from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

// Reconstructs the postings to a single account from the source documents that
// carry line items (invoices/bills, spend/receive money, credit notes, manual
// journals). This is the fork's stand-in for the gated Journals endpoint: it
// uses scopes the connection already has (accounting.transactions), but it
// won't perfectly tie to the P&L — system-generated journals (FX, rounding,
// some payment/overpayment allocations) have no document line items to read.
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap per source (up to 5,000 documents each)

export interface ListAccountTransactionsOptions {
  accountCode: string;
  fromDate?: string;
  toDate?: string;
}

export interface AccountTransactionLine {
  date?: string;
  sourceType: string; // ACCPAY, ACCREC, SPEND, RECEIVE, ACCPAYCREDIT, ACCRECCREDIT, MANUAL
  documentNumber?: string;
  documentId?: string;
  contact?: string;
  description?: string;
  lineAmount: number; // gross line amount as posted (net of tax)
  signedAmount: number; // GL effect, debit positive / credit negative
}

export interface ListAccountTransactionsResult {
  accountCode: string;
  lines: AccountTransactionLine[];
  truncated: boolean;
}

function dateExpr(date: string): string {
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  return `DateTime(${year}, ${month}, ${day})`;
}

function buildWhere(
  fromDate: string | undefined,
  toDate: string | undefined,
  extra?: string,
): string | undefined {
  const clauses: string[] = [];
  if (fromDate) clauses.push(`Date >= ${dateExpr(fromDate)}`);
  if (toDate) clauses.push(`Date <= ${dateExpr(toDate)}`);
  if (extra) clauses.push(extra);
  return clauses.length ? clauses.join(" && ") : undefined;
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(page);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return { items, truncated: false };
    }
  }
  return { items, truncated: true };
}

function matchesAccount(
  lineItems: LineItem[] | undefined,
  accountCode: string,
): LineItem[] {
  const target = accountCode.trim().toLowerCase();
  return (lineItems ?? []).filter(
    (line) => (line.accountCode ?? "").trim().toLowerCase() === target,
  );
}

const debit = (amount: number) => Math.abs(amount);
const credit = (amount: number) => -Math.abs(amount);

/**
 * Reconstruct the line-item postings to a single account from the source
 * documents, with an optional date range. A document-level stand-in for the
 * (now premium-gated) Journals endpoint.
 */
export async function listXeroAccountTransactions({
  accountCode,
  fromDate,
  toDate,
}: ListAccountTransactionsOptions): Promise<
  XeroClientResponse<ListAccountTransactionsResult>
> {
  try {
    await xeroClient.authenticate();
    const tenantId = xeroClient.tenantId;
    const headers = getClientHeaders();
    const lines: AccountTransactionLine[] = [];
    let truncated = false;

    // --- Invoices & bills (only posted statuses: AUTHORISED / PAID) ---
    const invoiceResult = await fetchAllPages<Invoice>((page) =>
      xeroClient.accountingApi
        .getInvoices(
          tenantId,
          undefined,
          buildWhere(fromDate, toDate),
          "Date ASC",
          undefined,
          undefined,
          undefined,
          ["AUTHORISED", "PAID"],
          page,
          false,
          false,
          undefined,
          false,
          PAGE_SIZE,
          undefined,
          headers,
        )
        .then((response) => response.body.invoices ?? []),
    );
    truncated = truncated || invoiceResult.truncated;
    for (const invoice of invoiceResult.items) {
      const isBill = invoice.type === Invoice.TypeEnum.ACCPAY;
      for (const line of matchesAccount(invoice.lineItems, accountCode)) {
        const amount = line.lineAmount ?? 0;
        lines.push({
          date: invoice.date,
          sourceType: isBill ? "ACCPAY" : "ACCREC",
          documentNumber: invoice.invoiceNumber,
          documentId: invoice.invoiceID,
          contact: invoice.contact?.name,
          description: line.description,
          lineAmount: amount,
          signedAmount: isBill ? debit(amount) : credit(amount),
        });
      }
    }

    // --- Spend / receive money bank transactions (AUTHORISED only) ---
    const bankResult = await fetchAllPages<BankTransaction>((page) =>
      xeroClient.accountingApi
        .getBankTransactions(
          tenantId,
          undefined,
          buildWhere(fromDate, toDate, 'Status=="AUTHORISED"'),
          "Date ASC",
          page,
          undefined,
          PAGE_SIZE,
          headers,
        )
        .then((response) => response.body.bankTransactions ?? []),
    );
    truncated = truncated || bankResult.truncated;
    for (const txn of bankResult.items) {
      const txnType = String(txn.type ?? "BANK");
      const isSpend = txnType.startsWith("SPEND");
      for (const line of matchesAccount(txn.lineItems, accountCode)) {
        const amount = line.lineAmount ?? 0;
        lines.push({
          date: txn.date,
          sourceType: txnType,
          documentNumber: txn.reference,
          documentId: txn.bankTransactionID,
          contact: txn.contact?.name,
          description: line.description,
          lineAmount: amount,
          signedAmount: isSpend ? debit(amount) : credit(amount),
        });
      }
    }

    // --- Credit notes (AUTHORISED / PAID) ---
    const creditNoteResult = await fetchAllPages<CreditNote>((page) =>
      xeroClient.accountingApi
        .getCreditNotes(
          tenantId,
          undefined,
          buildWhere(
            fromDate,
            toDate,
            '(Status=="AUTHORISED" || Status=="PAID")',
          ),
          "Date ASC",
          page,
          undefined,
          PAGE_SIZE,
          headers,
        )
        .then((response) => response.body.creditNotes ?? []),
    );
    truncated = truncated || creditNoteResult.truncated;
    for (const creditNote of creditNoteResult.items) {
      const isBillCredit = creditNote.type === CreditNote.TypeEnum.ACCPAYCREDIT;
      for (const line of matchesAccount(creditNote.lineItems, accountCode)) {
        const amount = line.lineAmount ?? 0;
        lines.push({
          date: creditNote.date,
          sourceType: isBillCredit ? "ACCPAYCREDIT" : "ACCRECCREDIT",
          documentNumber: creditNote.creditNoteNumber,
          documentId: creditNote.creditNoteID,
          contact: creditNote.contact?.name,
          description: line.description,
          lineAmount: amount,
          // A bill credit reverses an expense (credit); a sales credit
          // reverses revenue (debit).
          signedAmount: isBillCredit ? credit(amount) : debit(amount),
        });
      }
    }

    // --- Manual journals (POSTED only; line amounts are already signed) ---
    const manualJournalResult = await fetchAllPages<ManualJournal>((page) =>
      xeroClient.accountingApi
        .getManualJournals(
          tenantId,
          undefined,
          buildWhere(fromDate, toDate, 'Status=="POSTED"'),
          "Date ASC",
          page,
          PAGE_SIZE,
          headers,
        )
        .then((response) => response.body.manualJournals ?? []),
    );
    truncated = truncated || manualJournalResult.truncated;
    const target = accountCode.trim().toLowerCase();
    for (const journal of manualJournalResult.items) {
      for (const line of journal.journalLines ?? []) {
        if ((line.accountCode ?? "").trim().toLowerCase() !== target) continue;
        const amount = line.lineAmount ?? 0; // debit positive, credit negative
        lines.push({
          date: journal.date,
          sourceType: "MANUAL",
          documentNumber: journal.narration,
          documentId: journal.manualJournalID,
          description: line.description,
          lineAmount: amount,
          signedAmount: amount,
        });
      }
    }

    lines.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    return {
      result: { accountCode, lines, truncated },
      isError: false,
      error: null,
    };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
