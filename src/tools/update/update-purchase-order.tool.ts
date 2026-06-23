import { z } from "zod";
import { updateXeroPurchaseOrder } from "../../handlers/update-xero-purchase-order.handler.js";
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

const UpdatePurchaseOrderTool = CreateXeroTool(
  "update-purchase-order",
  "Update an existing purchase order in Xero. Only the fields you supply are changed; omitted fields are \
left as they are. Supplying lineItems replaces the existing line items. Set status to DELETED to cancel a \
purchase order, or to AUTHORISED to approve it.",
  {
    purchaseOrderId: z
      .string()
      .describe("The ID of the purchase order to update."),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe("Replacement line items for the purchase order."),
    date: z
      .string()
      .optional()
      .describe("The issue date of the purchase order (YYYY-MM-DD format)."),
    deliveryDate: z
      .string()
      .optional()
      .describe("The date the goods are to be delivered (YYYY-MM-DD format)."),
    reference: z
      .string()
      .optional()
      .describe("An additional reference number for the purchase order."),
    deliveryAddress: z
      .string()
      .optional()
      .describe("The address the goods are to be delivered to."),
    attentionTo: z
      .string()
      .optional()
      .describe("The person the delivery is going to."),
    deliveryInstructions: z
      .string()
      .optional()
      .describe("Free-text delivery instructions (500 characters max)."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "DELETED"])
      .optional()
      .describe(
        "The status to move the purchase order to. Use DELETED to cancel it.",
      ),
  },
  async ({
    purchaseOrderId,
    lineItems,
    date,
    deliveryDate,
    reference,
    deliveryAddress,
    attentionTo,
    deliveryInstructions,
    status,
  }) => {
    const result = await updateXeroPurchaseOrder({
      purchaseOrderId,
      lineItems,
      date,
      deliveryDate,
      reference,
      deliveryAddress,
      attentionTo,
      deliveryInstructions,
      status,
    });
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating purchase order: ${result.error}`,
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
            "Purchase order updated successfully:",
            `ID: ${purchaseOrder.purchaseOrderID}`,
            `Number: ${purchaseOrder.purchaseOrderNumber}`,
            `Status: ${purchaseOrder.status}`,
            `Total: ${purchaseOrder.total}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdatePurchaseOrderTool;
