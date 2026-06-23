import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LineItemTracking, PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface PurchaseOrderLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

/** Statuses a purchase order can be created with. */
export type CreatablePurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AUTHORISED";

export interface CreatePurchaseOrderParams {
  contactId: string;
  lineItems: PurchaseOrderLineItem[];
  date?: string;
  deliveryDate?: string;
  reference?: string;
  status?: CreatablePurchaseOrderStatus;
}

async function createPurchaseOrder({
  contactId,
  lineItems,
  date,
  deliveryDate,
  reference,
  status,
}: CreatePurchaseOrderParams): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const purchaseOrder: PurchaseOrder = {
    contact: { contactID: contactId },
    lineItems: lineItems,
    date: date || new Date().toISOString().split("T")[0],
    ...(deliveryDate ? { deliveryDate } : {}),
    ...(reference ? { reference } : {}),
    status: status
      ? PurchaseOrder.StatusEnum[status]
      : PurchaseOrder.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createPurchaseOrders(
    xeroClient.tenantId,
    { purchaseOrders: [purchaseOrder] },
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  return response.body.purchaseOrders?.[0];
}

/**
 * Create a new purchase order in Xero.
 */
export async function createXeroPurchaseOrder(
  params: CreatePurchaseOrderParams,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const created = await createPurchaseOrder(params);

    if (!created) {
      throw new Error("Purchase order creation failed.");
    }

    return { result: created, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
