import { basename } from "node:path";

import { z } from "zod";
import {
  ATTACHABLE_ENTITY_TYPES,
  uploadXeroAttachment,
} from "../../handlers/xero-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UploadAttachmentTool = CreateXeroTool(
  "upload-attachment",
  "Upload a local file as an attachment to an existing Xero record. \
Unlike create-invoice's attachmentPath (which only works at creation time), this attaches a document \
to a record that already exists — a bill or sales invoice, a bank transaction, a contact, a credit note, \
a manual journal, or a purchase order. \
Requires the `accounting.attachments` scope on the Xero app. Max file size 25 MB.",
  {
    entityType: z
      .enum(ATTACHABLE_ENTITY_TYPES)
      .describe(
        "The kind of Xero record to attach the file to. Use 'invoices' for both sales invoices (ACCREC) and bills (ACCPAY).",
      ),
    entityId: z
      .string()
      .describe(
        "The ID of the record to attach to, e.g. the invoiceID from list-invoices or contactID from list-contacts.",
      ),
    filePath: z
      .string()
      .describe(
        "Absolute local file path of the document to upload (e.g. the supplier's PDF). Max 25 MB.",
      ),
  },
  async ({ entityType, entityId, filePath }) => {
    const result = await uploadXeroAttachment(entityType, entityId, filePath);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment: ${result.error}`,
          },
        ],
      };
    }

    const attachment = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Attachment "${basename(filePath)}" uploaded to ${entityType} ${entityId}.`,
            `Attachment ID: ${attachment.attachmentID}`,
            `File name: ${attachment.fileName}`,
            attachment.mimeType ? `MIME type: ${attachment.mimeType}` : null,
            attachment.contentLength
              ? `Size: ${attachment.contentLength} bytes`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UploadAttachmentTool;
