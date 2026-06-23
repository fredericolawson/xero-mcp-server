import { z } from "zod";
import { listXeroPurchaseOrders } from "../../handlers/list-xero-purchase-orders.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListPurchaseOrdersTool = CreateXeroTool(
  "list-purchase-orders",
  "List purchase orders in Xero. Optionally filter by status and by issue-date range. \
Returns up to 100 purchase orders per page; ask the user if they want the next page when a full page is returned.",
  {
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .optional()
      .describe("Filter by a single purchase order status."),
    dateFrom: z
      .string()
      .optional()
      .describe("Only include purchase orders issued on or after this date (YYYY-MM-DD)."),
    dateTo: z
      .string()
      .optional()
      .describe("Only include purchase orders issued on or before this date (YYYY-MM-DD)."),
    order: z
      .string()
      .optional()
      .describe("Field to order results by, e.g. `Date DESC`."),
    page: z
      .number()
      .optional()
      .describe("Page number for pagination. Defaults to 1."),
  },
  async ({ status, dateFrom, dateTo, order, page }) => {
    const response = await listXeroPurchaseOrders({
      status,
      dateFrom,
      dateTo,
      order,
      page,
    });
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing purchase orders: ${response.error}`,
          },
        ],
      };
    }

    const purchaseOrders = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${purchaseOrders?.length || 0} purchase order(s):`,
        },
        ...(purchaseOrders?.map((purchaseOrder) => ({
          type: "text" as const,
          text: [
            `Purchase Order ID: ${purchaseOrder.purchaseOrderID}`,
            `Number: ${purchaseOrder.purchaseOrderNumber}`,
            purchaseOrder.reference
              ? `Reference: ${purchaseOrder.reference}`
              : null,
            `Status: ${purchaseOrder.status || "Unknown"}`,
            purchaseOrder.contact
              ? `Contact: ${purchaseOrder.contact.name} (${purchaseOrder.contact.contactID})`
              : null,
            purchaseOrder.date ? `Date: ${purchaseOrder.date}` : null,
            purchaseOrder.deliveryDate
              ? `Delivery Date: ${purchaseOrder.deliveryDate}`
              : null,
            purchaseOrder.subTotal ? `Sub Total: ${purchaseOrder.subTotal}` : null,
            purchaseOrder.totalTax ? `Total Tax: ${purchaseOrder.totalTax}` : null,
            `Total: ${purchaseOrder.total || 0}`,
            purchaseOrder.currencyCode
              ? `Currency: ${purchaseOrder.currencyCode}`
              : null,
            purchaseOrder.lineItems
              ? `Line Items: ${purchaseOrder.lineItems.map(formatLineItem)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPurchaseOrdersTool;
