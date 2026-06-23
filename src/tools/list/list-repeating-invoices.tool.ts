import { z } from "zod";
import { listXeroRepeatingInvoices } from "../../handlers/list-xero-repeating-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListRepeatingInvoicesTool = CreateXeroTool(
  "list-repeating-invoices",
  "List repeating (recurring) invoice templates in Xero — both recurring sales invoices and recurring bills. \
Each template shows its schedule (how often it repeats and the next scheduled date), contact, amount and status. \
Optionally filter with a Xero 'where' expression or order the results.",
  {
    where: z
      .string()
      .optional()
      .describe(
        "Optional Xero 'where' filter expression, e.g. `Status==\"AUTHORISED\"` or `Type==\"ACCPAY\"`.",
      ),
    order: z
      .string()
      .optional()
      .describe("Field to order results by, e.g. `Total DESC`."),
  },
  async ({ where, order }) => {
    const response = await listXeroRepeatingInvoices({ where, order });
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing repeating invoices: ${response.error}`,
          },
        ],
      };
    }

    const repeatingInvoices = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${repeatingInvoices?.length || 0} repeating invoice(s):`,
        },
        ...(repeatingInvoices?.map((repeatingInvoice) => ({
          type: "text" as const,
          text: [
            `Repeating Invoice ID: ${repeatingInvoice.repeatingInvoiceID}`,
            `Type: ${repeatingInvoice.type || "Unknown"}`,
            `Status: ${repeatingInvoice.status || "Unknown"}`,
            repeatingInvoice.reference
              ? `Reference: ${repeatingInvoice.reference}`
              : null,
            repeatingInvoice.contact
              ? `Contact: ${repeatingInvoice.contact.name} (${repeatingInvoice.contact.contactID})`
              : null,
            repeatingInvoice.schedule?.unit
              ? `Schedule: every ${repeatingInvoice.schedule.period ?? 1} ${repeatingInvoice.schedule.unit}`
              : null,
            repeatingInvoice.schedule?.nextScheduledDate
              ? `Next Scheduled Date: ${repeatingInvoice.schedule.nextScheduledDate}`
              : null,
            repeatingInvoice.schedule?.endDate
              ? `End Date: ${repeatingInvoice.schedule.endDate}`
              : null,
            repeatingInvoice.total !== undefined
              ? `Total: ${repeatingInvoice.total}`
              : null,
            repeatingInvoice.currencyCode
              ? `Currency: ${repeatingInvoice.currencyCode}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListRepeatingInvoicesTool;
