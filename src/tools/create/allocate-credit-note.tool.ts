import { z } from "zod";
import { createXeroCreditNoteAllocation } from "../../handlers/create-xero-credit-note-allocation.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const AllocateCreditNoteTool = CreateXeroTool(
  "allocate-credit-note",
  "Allocate (apply) a credit note to an invoice or bill in Xero, reducing the amount owing on that invoice. \
Both the credit note and the invoice must belong to the same contact and be AUTHORISED, and the credit note \
must have remaining credit. The allocated amount cannot exceed either the credit note's remaining balance or \
the invoice's amount due.",
  {
    creditNoteId: z
      .string()
      .describe(
        "The ID of the credit note to allocate. Can be obtained from the list-credit-notes tool.",
      ),
    invoiceId: z
      .string()
      .describe(
        "The ID of the invoice or bill to apply the credit to. Can be obtained from the list-invoices tool.",
      ),
    amount: z
      .number()
      .positive()
      .describe(
        "The amount of credit to apply to the invoice (must be positive).",
      ),
    date: z
      .string()
      .optional()
      .describe(
        "The date the allocation is applied (YYYY-MM-DD format). Defaults to today.",
      ),
  },
  async ({ creditNoteId, invoiceId, amount, date }) => {
    const result = await createXeroCreditNoteAllocation({
      creditNoteId,
      invoiceId,
      amount,
      date,
    });
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error allocating credit note: ${result.error}`,
          },
        ],
      };
    }

    const allocation = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Credit note allocated successfully:",
            `Credit Note ID: ${creditNoteId}`,
            `Invoice ID: ${invoiceId}`,
            `Amount Applied: ${allocation.amount}`,
            `Date: ${allocation.date}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default AllocateCreditNoteTool;
