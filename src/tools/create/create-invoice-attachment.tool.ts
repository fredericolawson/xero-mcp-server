import { z } from "zod";

import { createXeroInvoiceAttachment } from "../../handlers/create-xero-invoice-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreateInvoiceAttachmentTool = CreateXeroTool(
  "create-invoice-attachment",
  "Attach a local file (e.g. the source PDF of a bill) to an existing invoice or bill in Xero. \
The file's bytes are uploaded directly to Xero — no hosted URL is required. \
The invoice must already exist, so call create-invoice first and use the returned invoice ID. \
Xero accepts files up to 25 MB and up to 10 attachments per invoice.",
  {
    invoiceId: z
      .string()
      .describe(
        "The ID of the invoice or bill to attach the file to. Obtained from create-invoice or list-invoices.",
      ),
    filePath: z
      .string()
      .describe(
        "Absolute path to the local file to attach (e.g. the source PDF). The file is read from disk and its bytes are uploaded directly to Xero.",
      ),
  },
  async ({ invoiceId, filePath }) => {
    const response = await createXeroInvoiceAttachment(invoiceId, filePath);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error attaching file to invoice: ${response.error}`,
          },
        ],
      };
    }

    const attachment = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Attachment uploaded successfully:",
            `Invoice ID: ${invoiceId}`,
            `File: ${attachment?.fileName}`,
            attachment?.mimeType ? `Type: ${attachment.mimeType}` : null,
            typeof attachment?.contentLength === "number"
              ? `Size: ${attachment.contentLength} bytes`
              : null,
            attachment?.attachmentID
              ? `Attachment ID: ${attachment.attachmentID}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateInvoiceAttachmentTool;
