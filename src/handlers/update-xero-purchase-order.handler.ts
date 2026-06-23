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

/** Statuses a purchase order can be moved to via update (DELETED cancels it). */
export type UpdatablePurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AUTHORISED"
  | "DELETED";

export interface UpdatePurchaseOrderParams {
  purchaseOrderId: string;
  lineItems?: PurchaseOrderLineItem[];
  date?: string;
  deliveryDate?: string;
  reference?: string;
  deliveryAddress?: string;
  attentionTo?: string;
  deliveryInstructions?: string;
  status?: UpdatablePurchaseOrderStatus;
}

async function updatePurchaseOrder({
  purchaseOrderId,
  lineItems,
  date,
  deliveryDate,
  reference,
  deliveryAddress,
  attentionTo,
  deliveryInstructions,
  status,
}: UpdatePurchaseOrderParams): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  // Only the supplied fields are sent; omitted fields are left unchanged by
  // Xero (line items, when provided, replace the existing set).
  const purchaseOrder: PurchaseOrder = {
    lineItems: lineItems,
    date: date,
    deliveryDate: deliveryDate,
    reference: reference,
    deliveryAddress: deliveryAddress,
    attentionTo: attentionTo,
    deliveryInstructions: deliveryInstructions,
    status: status ? PurchaseOrder.StatusEnum[status] : undefined,
  };

  const response = await xeroClient.accountingApi.updatePurchaseOrder(
    xeroClient.tenantId,
    purchaseOrderId,
    { purchaseOrders: [purchaseOrder] },
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  return response.body.purchaseOrders?.[0];
}

/**
 * Update an existing purchase order in Xero.
 */
export async function updateXeroPurchaseOrder(
  params: UpdatePurchaseOrderParams,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const updated = await updatePurchaseOrder(params);

    if (!updated) {
      throw new Error("Purchase order update failed.");
    }

    return { result: updated, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
