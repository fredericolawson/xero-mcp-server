import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export type PurchaseOrderStatusFilter =
  | "DRAFT"
  | "SUBMITTED"
  | "AUTHORISED"
  | "BILLED"
  | "DELETED";

export interface ListPurchaseOrdersOptions {
  status?: PurchaseOrderStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  order?: string;
  page?: number;
}

async function getPurchaseOrders({
  status,
  dateFrom,
  dateTo,
  order,
  page = 1,
}: ListPurchaseOrdersOptions): Promise<PurchaseOrder[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPurchaseOrders(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    status, // status
    dateFrom, // dateFrom
    dateTo, // dateTo
    order, // order
    page, // page
    undefined, // pageSize
    getClientHeaders(),
  );
  return response.body.purchaseOrders ?? [];
}

/**
 * List purchase orders from Xero, optionally filtered by status and date range.
 */
export async function listXeroPurchaseOrders(
  options: ListPurchaseOrdersOptions = {},
): Promise<XeroClientResponse<PurchaseOrder[]>> {
  try {
    const purchaseOrders = await getPurchaseOrders(options);
    return { result: purchaseOrders, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
