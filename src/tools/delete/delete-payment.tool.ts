import { z } from "zod";
import { deleteXeroPayment } from "../../handlers/delete-xero-payment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeletePaymentTool = CreateXeroTool(
  "delete-payment",
  "Reverse (delete) a payment in Xero. The payment is moved to DELETED status and the amount paid is \
credited back to the linked invoice, restoring its amount owing. \
Note: a payment that has already been reconciled against a bank statement line cannot be deleted via the API \
— it must be un-reconciled in Xero first.",
  {
    paymentId: z
      .string()
      .describe(
        "The ID of the payment to reverse. Can be obtained from the list-payments tool.",
      ),
  },
  async ({ paymentId }) => {
    const result = await deleteXeroPayment(paymentId);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reversing payment: ${result.error}`,
          },
        ],
      };
    }

    const payment = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Payment reversed successfully:",
            `ID: ${payment.paymentID}`,
            `Status: ${payment.status}`,
            payment.invoice?.invoiceID
              ? `Invoice ID: ${payment.invoice.invoiceID}`
              : null,
            payment.amount !== undefined ? `Amount: ${payment.amount}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default DeletePaymentTool;
