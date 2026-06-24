import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroAccountTransactions } from "../../handlers/list-xero-account-transactions.handler.js";

const ListAccountTransactionsTool = CreateXeroTool(
  "list-account-transactions",
  "Show the individual line items posted to a single account over a period — the transactions that make up an account's balance (e.g. exactly which bills make up an expense account). \
It reconstructs this from the source documents that carry line items: invoices/bills, spend/receive money bank transactions, credit notes and manual journals (only posted statuses are included). \
Each line shows its date, source document, contact, description, line amount and a GL effect (debit positive, credit negative); a net total is the sum of those effects. \
NOTE: this is a document-level approximation and will not perfectly reconcile to the Profit & Loss — system-generated postings (FX gains/losses, rounding, some payment/overpayment allocations) have no document line items and are not captured. \
Use list-accounts first to find the account code.",
  {
    accountCode: z
      .string()
      .describe(
        "The account code to analyse, e.g. \"429\". Find codes with list-accounts.",
      ),
    fromDate: z
      .string()
      .optional()
      .describe("Only include documents dated on or after this date (YYYY-MM-DD)."),
    toDate: z
      .string()
      .optional()
      .describe("Only include documents dated on or before this date (YYYY-MM-DD)."),
  },
  async ({ accountCode, fromDate, toDate }) => {
    const response = await listXeroAccountTransactions({
      accountCode,
      fromDate,
      toDate,
    });
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing account transactions: ${response.error}`,
          },
        ],
      };
    }

    const lines = response.result?.lines ?? [];
    const truncated = response.result?.truncated ?? false;
    const skipped = response.result?.skipped ?? [];

    const net = lines.reduce((sum, line) => sum + line.signedAmount, 0);

    // Subtotal by source type for a quick breakdown.
    const bySource = new Map<string, { count: number; net: number }>();
    for (const line of lines) {
      const entry = bySource.get(line.sourceType) ?? { count: 0, net: 0 };
      entry.count += 1;
      entry.net += line.signedAmount;
      bySource.set(line.sourceType, entry);
    }
    const sourceSummary = Array.from(bySource.entries()).map(
      ([source, { count, net: sourceNet }]) =>
        `  ${source}: ${count} line(s), net ${sourceNet.toFixed(2)}`,
    );

    const range =
      fromDate || toDate
        ? ` (${fromDate ?? "earliest"} to ${toDate ?? "latest"})`
        : "";

    const header = [
      `Account ${accountCode}${range}: ${lines.length} line item(s).`,
      `Net movement (debits positive, credits negative): ${net.toFixed(2)}`,
      truncated
        ? "NOTE: hit the per-source pagination cap — some documents may be missing; narrow the date range."
        : null,
      skipped.length
        ? `NOTE: could not read these source(s), so their postings are missing: ${skipped.join(
            ", ",
          )} (likely a missing scope on the connection).`
        : null,
      sourceSummary.length ? `By source:\n${sourceSummary.join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        { type: "text" as const, text: header },
        ...lines.map((line) => ({
          type: "text" as const,
          text: [
            `${line.date ?? "no date"} — ${line.sourceType}${
              line.documentNumber ? ` ${line.documentNumber}` : ""
            }`,
            line.contact ? `Contact: ${line.contact}` : null,
            line.description ? `Description: ${line.description}` : null,
            `Line amount: ${line.lineAmount} | GL effect: ${line.signedAmount.toFixed(
              2,
            )}`,
            line.documentId ? `Document ID: ${line.documentId}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
);

export default ListAccountTransactionsTool;
