import { z } from "zod";
import { voidXeroInvoice } from "../../handlers/void-xero-invoice.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Invoice } from "xero-node";

const VoidInvoiceTool = CreateXeroTool(
  "void-invoice",
  "Void an invoice or bill in Xero. An approved (AUTHORISED) invoice is set to VOIDED; a DRAFT or SUBMITTED invoice is cancelled by setting it to DELETED. \
This is permanent and cannot be undone. An invoice that has payments applied cannot be voided until the payment(s) are removed in Xero first.",
  {
    invoiceId: z
      .string()
      .describe(
        "The ID of the invoice or bill to void. Can be obtained from create-invoice or list-invoices.",
      ),
  },
  async ({ invoiceId }) => {
    const result = await voidXeroInvoice(invoiceId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error voiding invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;
    const action =
      invoice?.status === Invoice.StatusEnum.DELETED ? "deleted" : "voided";

    const deepLink = invoice?.invoiceID
      ? await getDeepLink(
          invoice.type === Invoice.TypeEnum.ACCREC
            ? DeepLinkType.INVOICE
            : DeepLinkType.BILL,
          invoice.invoiceID,
        )
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Invoice ${action} successfully:`,
            `ID: ${invoice?.invoiceID}`,
            invoice?.invoiceNumber
              ? `Invoice Number: ${invoice.invoiceNumber}`
              : null,
            invoice?.contact ? `Contact: ${invoice.contact.name}` : null,
            `Type: ${invoice?.type}`,
            `Status: ${invoice?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default VoidInvoiceTool;
