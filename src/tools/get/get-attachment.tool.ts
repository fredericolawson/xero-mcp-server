import { z } from "zod";
import {
  ATTACHABLE_ENTITY_TYPES,
  getXeroAttachment,
} from "../../handlers/xero-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const GetAttachmentTool = CreateXeroTool(
  "get-attachment",
  "Download a named attachment from an existing Xero record and save it to a local file. \
Use list-attachments first to discover the file name. Works for invoices and bills, bank transactions, \
contacts, credit notes, manual journals, and purchase orders. \
Requires the `accounting.attachments` scope on the Xero app.",
  {
    entityType: z
      .enum(ATTACHABLE_ENTITY_TYPES)
      .describe(
        "The kind of Xero record the attachment is on. Use 'invoices' for both sales invoices (ACCREC) and bills (ACCPAY).",
      ),
    entityId: z
      .string()
      .describe("The ID of the record the attachment is on."),
    fileName: z
      .string()
      .describe(
        "The file name of the attachment to download, as shown by list-attachments.",
      ),
    destinationPath: z
      .string()
      .describe(
        "Absolute local file path to write the downloaded attachment to (e.g. /Users/me/Downloads/bill.pdf).",
      ),
  },
  async ({ entityType, entityId, fileName, destinationPath }) => {
    const result = await getXeroAttachment(
      entityType,
      entityId,
      fileName,
      destinationPath,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading attachment: ${result.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Downloaded "${fileName}" (${result.result.bytes} bytes) to ${result.result.destinationPath}`,
        },
      ],
    };
  },
);

export default GetAttachmentTool;
