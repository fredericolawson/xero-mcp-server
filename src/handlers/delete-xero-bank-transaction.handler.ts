import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { BankTransaction } from "xero-node";

async function getBankTransaction(bankTransactionId: string): Promise<BankTransaction | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getBankTransaction(
    xeroClient.tenantId, // xeroTenantId
    bankTransactionId, // bankTransactionID
    undefined, // unitdp
    getClientHeaders() // options
  );

  return response.body.bankTransactions?.[0];
}

async function deleteBankTransaction(
  bankTransactionId: string,
  existingBankTransaction: BankTransaction
): Promise<BankTransaction | undefined> {
  // Xero has no DELETE verb for bank transactions: a Spend/Receive Money
  // transaction is "deleted" by updating its status to DELETED.
  const bankTransaction: BankTransaction = {
    ...existingBankTransaction,
    bankTransactionID: bankTransactionId,
    status: BankTransaction.StatusEnum.DELETED
  };

  const response = await xeroClient.accountingApi.updateBankTransaction(
    xeroClient.tenantId, // xeroTenantId
    bankTransactionId, // bankTransactionID
    { bankTransactions: [bankTransaction] }, // bankTransactions
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders() // options
  );

  return response.body.bankTransactions?.[0];
}

export async function deleteXeroBankTransaction(
  bankTransactionId: string
): Promise<XeroClientResponse<BankTransaction>> {
  try {
    const existingBankTransaction = await getBankTransaction(bankTransactionId);

    if (!existingBankTransaction) {
      throw new Error(`Could not find bank transaction`);
    }

    const type = existingBankTransaction.type;
    if (
      type !== BankTransaction.TypeEnum.SPEND &&
      type !== BankTransaction.TypeEnum.RECEIVE
    ) {
      throw new Error(
        `Only Spend Money (SPEND) and Receive Money (RECEIVE) transactions can be deleted via the API. \
This transaction is of type ${type}. Bank transfers must be deleted in the Xero UI.`
      );
    }

    const deletedBankTransaction = await deleteBankTransaction(
      bankTransactionId,
      existingBankTransaction
    );

    if (!deletedBankTransaction) {
      throw new Error(`Failed to delete bank transaction`);
    }

    return {
      result: deletedBankTransaction,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
