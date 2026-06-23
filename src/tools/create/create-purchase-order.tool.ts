import { z } from "zod";
import { createXeroPurchaseOrder } from "../../handlers/create-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const trackingSchema = z.object({
  name: z
    .string()
    .describe(
      "The name of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
  option: z
    .string()
    .describe(
      "The name of the tracking option. Can be obtained from the list-tracking-categories tool",
    ),
  trackingCategoryID: z
    .string()
    .describe(
      "The ID of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z
    .string()
    .describe(
      "The account code of the line item - can be obtained from the list-accounts tool",
    ),
  taxType: z
    .string()
    .describe(
      "The tax type of the line item - can be obtained from the list-tax-rates tool",
    ),
  itemCode: z
    .string()
    .describe(
      "The item code of the line item - can be obtained from the list-items tool",
    )
    .optional(),
  tracking: z
    .array(trackingSchema)
    .describe(
      "Up to 2 tracking categories and options can be added to the line item.",
    )
    .optional(),
});

const CreatePurchaseOrderTool = CreateXeroTool(
  "create-purchase-order",
  "Create a purchase order in Xero. A purchase order records goods or services you intend to buy from a \
supplier, and can later be copied to a bill. Provide the supplier's contact ID and one or more line items. \
Defaults to DRAFT status; use AUTHORISED to approve it on creation.",
  {
    contactId: z
      .string()
      .describe(
        "The ID of the supplier contact to raise the purchase order for. Can be obtained from the list-contacts tool.",
      ),
    lineItems: z.array(lineItemSchema),
    date: z
      .string()
      .optional()
      .describe(
        "The date the purchase order was issued (YYYY-MM-DD format). Defaults to today.",
      ),
    deliveryDate: z
      .string()
      .optional()
      .describe("The date the goods are to be delivered (YYYY-MM-DD format)."),
    reference: z
      .string()
      .optional()
      .describe("An additional reference number for the purchase order."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED"])
      .optional()
      .describe(
        "The status to create the purchase order with. Defaults to DRAFT. Use AUTHORISED to approve on creation.",
      ),
  },
  async ({ contactId, lineItems, date, deliveryDate, reference, status }) => {
    const result = await createXeroPurchaseOrder({
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      status,
    });
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating purchase order: ${result.error}`,
          },
        ],
      };
    }

    const purchaseOrder = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Purchase order created successfully:",
            `ID: ${purchaseOrder.purchaseOrderID}`,
            `Number: ${purchaseOrder.purchaseOrderNumber}`,
            `Contact: ${purchaseOrder.contact?.name}`,
            `Date: ${purchaseOrder.date}`,
            purchaseOrder.deliveryDate
              ? `Delivery Date: ${purchaseOrder.deliveryDate}`
              : null,
            `Total: ${purchaseOrder.total}`,
            `Status: ${purchaseOrder.status}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreatePurchaseOrderTool;
