import { z } from "zod";
import {
  ATTACHABLE_ENTITY_TYPES,
  listXeroAttachments,
} from "../../handlers/xero-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListAttachmentsTool = CreateXeroTool(
  "list-attachments",
  "List the attachments (file name, MIME type and size) held against an existing Xero record — \
an invoice or bill, a bank transaction, a contact, a credit note, a manual journal, or a purchase order. \
Use this to discover what files are attached before downloading one with get-attachment.",
  {
    entityType: z
      .enum(ATTACHABLE_ENTITY_TYPES)
      .describe(
        "The kind of Xero record to list attachments for. Use 'invoices' for both sales invoices (ACCREC) and bills (ACCPAY).",
      ),
    entityId: z
      .string()
      .describe("The ID of the record to list attachments for."),
  },
  async ({ entityType, entityId }) => {
    const response = await listXeroAttachments(entityType, entityId);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${response.error}`,
          },
        ],
      };
    }

    const attachments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${attachments?.length || 0} attachment(s) on ${entityType} ${entityId}:`,
        },
        ...(attachments?.map((attachment) => ({
          type: "text" as const,
          text: [
            `File name: ${attachment.fileName}`,
            `Attachment ID: ${attachment.attachmentID}`,
            attachment.mimeType ? `MIME type: ${attachment.mimeType}` : null,
            attachment.contentLength
              ? `Size: ${attachment.contentLength} bytes`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListAttachmentsTool;
