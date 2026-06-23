import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroJournals } from "../../handlers/list-xero-journals.handler.js";

const ListJournalsTool = CreateXeroTool(
  "list-journals",
  "List general-ledger journals from Xero — the double-entry postings that every transaction (invoices, bills, credit notes, payments, bank transactions, manual journals) generates. \
This is the data the Profit & Loss and Balance Sheet are built from, so it lets you decompose any account's total into the individual line items behind it (e.g. exactly which postings make up an expense account over a period). \
Each journal line carries the account it was posted to (code, name and type — e.g. EXPENSE, REVENUE, BANK), the description from the source line item, and net/gross/tax amounts (net is positive for debits, negative for credits). \
The whole ledger is fetched and paginated automatically. Optionally narrow by date range and/or account code(s), applied client-side; when account codes are given, only matching lines are returned. \
Returns accrual-basis journals by default — set paymentsOnly to true for cash-basis (payment) journals to match a cash-basis report.",
  {
    fromDate: z
      .string()
      .optional()
      .describe(
        "Only include journals dated on or after this date (YYYY-MM-DD). Filtered client-side.",
      ),
    toDate: z
      .string()
      .optional()
      .describe(
        "Only include journals dated on or before this date (YYYY-MM-DD). Filtered client-side.",
      ),
    accountCodes: z
      .array(z.string())
      .optional()
      .describe(
        'Only include journal lines posted to these account codes, e.g. ["429", "433"]. Journals with no matching line are omitted.',
      ),
    paymentsOnly: z
      .boolean()
      .optional()
      .describe(
        "If true, return only cash-basis (payment) journals instead of the default accrual-basis journals.",
      ),
  },
  async ({ fromDate, toDate, accountCodes, paymentsOnly }) => {
    const response = await listXeroJournals({
      fromDate,
      toDate,
      accountCodes,
      paymentsOnly,
    });
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing journals: ${response.error}`,
          },
        ],
      };
    }

    const journals = response.result?.journals ?? [];
    const truncated = response.result?.truncated ?? false;

    // Net total by account across the (filtered) lines — the headline figures
    // behind each account, with the individual postings listed below.
    const totals = new Map<string, { name?: string; net: number }>();
    for (const journal of journals) {
      for (const line of journal.journalLines ?? []) {
        const code = line.accountCode ?? "(no code)";
        const entry = totals.get(code) ?? { name: line.accountName, net: 0 };
        entry.net += line.netAmount ?? 0;
        if (!entry.name) entry.name = line.accountName;
        totals.set(code, entry);
      }
    }

    const summaryLines = Array.from(totals.entries())
      .sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
      .map(
        ([code, { name, net }]) =>
          `  ${code}${name ? ` ${name}` : ""}: ${net.toFixed(2)}`,
      );

    const header = [
      `Found ${journals.length} journal(s)${
        accountCodes?.length
          ? ` with lines on account code(s) ${accountCodes.join(", ")}`
          : ""
      }.`,
      truncated
        ? "NOTE: hit the pagination safety cap (10,000 journals) — only the earliest part of the ledger was scanned and newer journals may be missing. Narrow the request or run against a smaller ledger."
        : null,
      summaryLines.length
        ? `Net total by account (debits positive, credits negative):\n${summaryLines.join(
            "\n",
          )}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        { type: "text" as const, text: header },
        ...journals.map((journal) => ({
          type: "text" as const,
          text: [
            `Journal ${journal.journalNumber ?? "?"} — ${
              journal.journalDate ?? "no date"
            }`,
            journal.sourceType
              ? `Source: ${journal.sourceType}${
                  journal.sourceID ? ` (${journal.sourceID})` : ""
                }`
              : null,
            journal.reference ? `Reference: ${journal.reference}` : null,
            ...(journal.journalLines ?? []).map(
              (line) =>
                `  • ${line.accountCode ?? "?"} ${line.accountName ?? ""} [${
                  line.accountType ?? "?"
                }]: ${line.netAmount ?? 0}` +
                (line.taxAmount ? ` (tax ${line.taxAmount})` : "") +
                (line.description ? ` — ${line.description}` : ""),
            ),
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
);

export default ListJournalsTool;
