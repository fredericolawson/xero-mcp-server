import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CurrencyCode, Invoice, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

/** Statuses an invoice can be created with. */
export type CreatableInvoiceStatus = "DRAFT" | "SUBMITTED" | "AUTHORISED";

export interface CreateInvoiceParams {
  contactId: string;
  lineItems: InvoiceLineItem[];
  type: Invoice.TypeEnum;
  reference?: string;
  date?: string;
  dueDate?: string;
  currencyCode?: string;
  status?: CreatableInvoiceStatus;
}

/**
 * Validate and convert a 3-letter ISO currency string into the SDK enum.
 * Throws a user-meaningful error for unsupported codes.
 */
function resolveCurrencyCode(currencyCode?: string): CurrencyCode | undefined {
  if (!currencyCode) return undefined;
  const code = currencyCode.toUpperCase();
  if (!(code in CurrencyCode)) {
    throw new Error(
      `Unsupported currency code: "${currencyCode}". Use a 3-letter ISO code such as GBP, EUR or USD.`,
    );
  }
  // xero-node's .d.ts declares CurrencyCode without its string values, so TS
  // types it as numeric; at runtime the enum values ARE the 3-letter strings
  // (e.g. CurrencyCode.GBP === "GBP"), which is exactly what the API expects.
  return code as unknown as CurrencyCode;
}

async function createInvoice({
  contactId,
  lineItems,
  type,
  reference,
  date,
  dueDate,
  currencyCode,
  status,
}: CreateInvoiceParams): Promise<Invoice | undefined> {
  // Validate currency up front so we fail fast on a bad code.
  const resolvedCurrency = resolveCurrencyCode(currencyCode);

  await xeroClient.authenticate();

  const invoiceDate = date || new Date().toISOString().split("T")[0];

  const invoice: Invoice = {
    type: type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: invoiceDate,
    dueDate:
      dueDate ||
      new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // provided due date, or 30 days after the invoice date
    ...(type === Invoice.TypeEnum.ACCPAY
      ? { invoiceNumber: reference }
      : { reference: reference }),
    ...(resolvedCurrency ? { currencyCode: resolvedCurrency } : {}),
    status: status ? Invoice.StatusEnum[status] : Invoice.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createInvoices(
    xeroClient.tenantId,
    {
      invoices: [invoice],
    }, // invoices
    true, //summarizeErrors
    undefined, //unitdp
    undefined, //idempotencyKey
    getClientHeaders(),
  );
  const createdInvoice = response.body.invoices?.[0];
  return createdInvoice;
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroInvoice(
  params: CreateInvoiceParams,
): Promise<XeroClientResponse<Invoice>> {
  try {
    const createdInvoice = await createInvoice(params);

    if (!createdInvoice) {
      throw new Error("Invoice creation failed.");
    }

    return {
      result: createdInvoice,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
