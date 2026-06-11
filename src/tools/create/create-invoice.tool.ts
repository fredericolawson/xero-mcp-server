import { basename } from "node:path";

import { z } from "zod";
import { createXeroInvoice } from "../../handlers/create-xero-invoice.handler.js";
import { createXeroInvoiceAttachment } from "../../handlers/create-xero-invoice-attachment.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { validateAttachmentFile } from "../../helpers/validate-attachment-file.js";
import { Invoice } from "xero-node";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. \
    Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool \
    If the item is not listed, add without an item code and ask the user if they would like to add an item code.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
});

const CreateInvoiceTool = CreateXeroTool(
  "create-invoice",
  "Create an invoice in Xero.\
 When an invoice is created, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the invoice in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string().describe("The ID of the contact to create the invoice for. \
      Can be obtained from the list-contacts tool."),

    lineItems: z.array(lineItemSchema),
    type: z.enum(["ACCREC", "ACCPAY"]).describe("The type of invoice to create. \
      ACCREC is for sales invoices, Accounts Receivable, or customer invoices. \
      ACCPAY is for purchase invoices, Accounts Payable invoices, supplier invoices, or bills. \
      If the type is not specified, the default is ACCREC."),
    reference: z.string().describe("A reference number for the invoice.").optional(),
    date: z.string().describe("The date the invoice was created (YYYY-MM-DD format).").optional(),
    dueDate: z.string().describe("The date the invoice is due (YYYY-MM-DD format). \
      If omitted, defaults to 30 days after the invoice date.").optional(),
    currencyCode: z.string().describe("The 3-letter ISO currency code for the invoice, e.g. GBP, EUR, USD. \
      If omitted, the invoice uses the contact's default currency. The currency must be enabled on the Xero \
      organisation, and it is fixed once the invoice is created (it cannot be changed afterwards).").optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED"]).describe("The status to create the invoice with. \
      Defaults to DRAFT. Use AUTHORISED to approve the invoice on creation (it must be complete and valid).").optional(),
    attachmentPath: z.string().describe("Absolute local file path of a document (e.g. the supplier's PDF) to \
      upload and attach to the invoice once it is created. Max 25 MB. The file is validated before the invoice \
      is created, so a bad path fails cleanly without creating anything.").optional(),
  },
  async ({ contactId, lineItems, type, reference, date, dueDate, currencyCode, status, attachmentPath }) => {
    // Validate the attachment up front so a bad file path fails before the
    // invoice exists, rather than leaving a bill behind with no document.
    if (attachmentPath) {
      const validationError = validateAttachmentFile(attachmentPath);
      if (validationError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating invoice: the invoice was NOT created because the attachment file failed validation: ${validationError}`,
            },
          ],
        };
      }
    }

    const xeroInvoiceType = type === "ACCREC" ? Invoice.TypeEnum.ACCREC : Invoice.TypeEnum.ACCPAY;
    const result = await createXeroInvoice({
      contactId,
      lineItems,
      type: xeroInvoiceType,
      reference,
      date,
      dueDate,
      currencyCode,
      status,
    });
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;

    const deepLink = invoice.invoiceID
      ? await getDeepLink(
          invoice.type === Invoice.TypeEnum.ACCREC ? DeepLinkType.INVOICE : DeepLinkType.BILL,
          invoice.invoiceID,
        )
      : null;

    let attachmentStatus: string | null = null;
    if (attachmentPath && invoice.invoiceID) {
      const attachmentResult = await createXeroInvoiceAttachment(
        invoice.invoiceID,
        attachmentPath,
      );
      attachmentStatus = attachmentResult.isError
        ? `WARNING — the invoice was created, but uploading "${basename(attachmentPath)}" failed: ${attachmentResult.error}. \
Do NOT create the invoice again. Either attach the file manually in Xero via the link below, or void this invoice with void-invoice and recreate it.`
        : `Attachment: "${basename(attachmentPath)}" uploaded`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice created successfully:",
            `ID: ${invoice?.invoiceID}`,
            `Contact: ${invoice?.contact?.name}`,
            `Type: ${invoice?.type}`,
            `Date: ${invoice?.date}`,
            invoice?.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice?.currencyCode ? `Currency: ${invoice.currencyCode}` : null,
            `Total: ${invoice?.total}`,
            `Status: ${invoice?.status}`,
            attachmentStatus,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateInvoiceTool;
