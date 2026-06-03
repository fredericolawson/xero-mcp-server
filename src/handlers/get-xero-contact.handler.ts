import { Contact } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getContact(contactId: string): Promise<Contact | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getContact(
    xeroClient.tenantId,
    contactId,
    getClientHeaders(),
  );

  return response.body.contacts?.[0] ?? null;
}

/**
 * Get a single contact from Xero by its contact ID.
 *
 * Unlike the summary list response, fetching a contact by ID returns the full
 * object including addresses, phones, contact persons, balances and payment
 * terms.
 */
export async function getXeroContact(
  contactId: string,
): Promise<XeroClientResponse<Contact | null>> {
  try {
    const contact = await getContact(contactId);

    return {
      result: contact,
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
