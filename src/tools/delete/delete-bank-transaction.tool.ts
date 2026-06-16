import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { deleteXeroBankTransaction } from "../../handlers/delete-xero-bank-transaction.handler.js";
import { bankTransactionDeepLink } from "../../consts/deeplinks.js";

const DeleteBankTransactionTool = CreateXeroTool(
  "delete-bank-transaction",
  `Delete a bank transaction (Spend Money or Receive Money) in Xero by setting its status to DELETED.
  Only SPEND and RECEIVE bank transactions can be deleted this way; bank transfers must be deleted in the Xero UI.
  A reconciled transaction must be un-reconciled in Xero before it can be deleted.
  When a bank transaction is deleted, a deep link to the bank transaction in Xero is returned.
  This link should be displayed to the user.`,
  {
    bankTransactionId: z
      .string()
      .describe("The ID of the bank transaction to delete."),
  },
  async ({ bankTransactionId }) => {
    const result = await deleteXeroBankTransaction(bankTransactionId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting bank transaction: ${result.error}`,
          },
        ],
      };
    }

    const bankTransaction = result.result;

    const deepLink =
      bankTransaction?.bankAccount?.accountID && bankTransaction?.bankTransactionID
        ? bankTransactionDeepLink(
            bankTransaction.bankAccount.accountID,
            bankTransaction.bankTransactionID
          )
        : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Bank transaction deleted successfully:",
            `ID: ${bankTransaction?.bankTransactionID}`,
            `Date: ${bankTransaction?.date}`,
            `Contact: ${bankTransaction?.contact?.name}`,
            `Total: ${bankTransaction?.total}`,
            `Status: ${bankTransaction?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }
);

export default DeleteBankTransactionTool;
