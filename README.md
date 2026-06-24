# Xero MCP Server — Enhanced Fork

A Model Context Protocol (MCP) server for [Xero](https://www.xero.com/). It bridges the MCP protocol and Xero's API so an MCP client (Claude Desktop, Claude Code, etc.) can read and write your Xero accounting data through natural language.

This is a **fork of the official [`xeroapi/xero-mcp-server`](https://github.com/XeroAPI/xero-mcp-server)**, with extra tools and richer parameters aimed at real bookkeeping workflows — multi-currency bills, attaching source PDFs, deduping, and cleaning up bad data. Everything in the official server is here; the sections below cover what's been added on top.

> Because this fork isn't published to npm under its own name, don't install it via `npx @xeroapi/xero-mcp-server` — that command pulls the official upstream package, not this one. Instead run it straight from GitHub with `npx` or from a local build (see [Running this fork](#running-this-fork)).

---

## What this fork adds over the official Xero MCP

### New tools

| Tool | What it does | Gap in the official MCP it fills |
|------|--------------|----------------------------------|
| `get-contact` | Fetch a **single contact's full record** by ID — addresses, phones, contact persons, outstanding/overdue balances, payment terms, tax details and default account codes. | Upstream only has a lightweight `list-contacts`; there's no way to pull one contact's full detail. |
| `void-invoice` | **Void/cancel an invoice or bill**: an approved (AUTHORISED) invoice → `VOIDED`; a `DRAFT`/`SUBMITTED` one → `DELETED`. Blocks cleanly if payments are applied. | Upstream has no void or delete path for invoices. |
| `delete-bank-transaction` | **Delete a Spend Money / Receive Money transaction** (sets its status to `DELETED`). Guards against bank transfers (which the API can't delete) and surfaces a clear "un-reconcile first" error when needed. | Upstream exposes create/list/update for bank transactions but no delete. |
| `create-purchase-order` / `list-purchase-orders` / `update-purchase-order` | **Raise and manage purchase orders** — the procurement step that precedes a bill. Create as DRAFT/SUBMITTED/AUTHORISED, filter by status and date, and update or cancel (DELETED). | Upstream has no purchase order support at all. |
| `upload-attachment` / `list-attachments` / `get-attachment` | **Attach, list and download files on records that already exist** — bills/invoices, bank transactions, contacts, credit notes, manual journals and purchase orders. | Upstream can only attach a file to an invoice *at creation time* (and can't read attachments back). |
| `allocate-credit-note` | **Apply a credit note to an invoice or bill**, reducing the amount owing. | Upstream can create a credit note but never allocate it, leaving the credit stranded. |
| `delete-payment` | **Reverse a payment**, crediting the amount back to the linked invoice. | Upstream has no way to undo a payment. |
| `list-repeating-invoices` | **List recurring invoice/bill templates** and their schedules. | Upstream has no repeating-invoice support. |
| `list-account-transactions` | **Decompose an account into its transactions** — lists the individual line items posted to one account over a period (from invoices/bills, spend/receive money, credit notes and manual journals), with a net GL movement. | Upstream only exposes account *totals* via the summary reports; there's no way to see the transactions that make up an account balance. |

### Enhanced existing tools

| Tool | Parameters this fork adds (on top of the upstream ones) |
|------|---------------------------------------------------------|
| `create-invoice` | `currencyCode` (multi-currency bills), `dueDate`, `status` (`DRAFT`/`SUBMITTED`/`AUTHORISED` — create approved bills directly, skipping the manual draft-approval step), and `attachmentPath` (upload a local file, e.g. a supplier PDF, onto the new bill **in the same call**; the file is validated *before* the invoice is created, so a bad path never leaves an orphaned bill). |
| `list-invoices` | `statuses`, `where` (arbitrary Xero filter expressions, e.g. `Type=="ACCPAY"`), and `order`. (Upstream already supports `page`, `contactIds`, `invoiceNumbers`.) |
| `list-contacts` | `where`, `order`, `includeArchived`, `summaryOnly=false` (full-detail mode with addresses/phones/balances/payment terms), and `pageSize`, with bounded pagination. (Upstream supports `page` and `searchTerm`.) |
| `update-contact` | `defaultCurrency` — set a contact's default currency via the API, so new invoices/bills inherit it. |

Together these turn the server into an end-to-end **bill-processing pipeline**: look up a contact, dedup against existing bills by invoice number, create an AUTHORISED multi-currency bill with the source PDF attached in one call, and void/delete entries that were booked in error.

---

## Features

- Xero OAuth2 authentication (custom connections **and** bearer token)
- Contact, invoice, bank transaction, and Chart of Accounts management
- Multi-currency invoicing with PDF attachments
- Reports: P&L, balance sheet, trial balance, aged payables/receivables
- Payroll (NZ/UK): employees, leave, timesheets
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

## Docs and Links

- [Official upstream project](https://github.com/XeroAPI/xero-mcp-server) (this fork tracks it as the `upstream` git remote)
- [Xero Public API Documentation](https://developer.xero.com/documentation/api/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero OpenAPI Specs](https://github.com/XeroAPI/Xero-OpenAPI)
- [Xero-Node Public API SDK Docs](https://xeroapi.github.io/xero-node/accounting)
- [Developer Documentation](https://developer.xero.com/)

## Setup

### Create a Xero Account

If you don't already have a Xero account and organisation, you can create one by signing up [here](https://www.xero.com/au/signup/) using the free trial.

We recommend using a Demo Company to start with because it comes with some pre-loaded sample data. Once you are logged in, switch to it by using the top left-hand dropdown and selecting "Demo Company". You can reset the data on a Demo Company, or change the country, at any time by using the top left-hand dropdown and navigating to [My Xero](https://my.xero.com).

NOTE: To use Payroll-specific queries, the region should be either NZ or UK.

### Authentication

There are 2 modes of authentication supported in the Xero MCP server:

#### 1. Custom Connections

This is a better choice for testing and development, which lets you specify a client id and secret for a specific organisation. It's also the recommended approach for integrating into 3rd-party MCP clients such as Claude Desktop.

##### Configuring your Xero Developer account

Set up a Custom Connection following these instructions: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

##### Required Scopes

Custom connections require different scopes depending on when they were created. **All scopes in the relevant list must be added to your custom connection:**

| Custom Connection Created | Required Scopes |
|---------------------------|-----------------|
| Before Apr 29, 2026 | [SCOPES_V1](src/clients/xero-client.ts#L82-L90) (bundled permissions) |
| From Apr 29, 2026 | [SCOPES_V2](src/clients/xero-client.ts#L93-L112) (granular permissions) |

> **Note:** The MCP server automatically tries V1 scopes first and falls back to V2 if needed.
>
> You can override these by setting the `XERO_SCOPES` environment variable to a space-separated list of scopes.
>
> **Fork-specific:** the `attachmentPath` option on `create-invoice` and the `upload-attachment` / `list-attachments` / `get-attachment` tools need the **`accounting.attachments`** scope. The purchase-order tools, `list-repeating-invoices` and `list-account-transactions` rely on **`accounting.transactions`** (part of the default V1 scope bundle). Add these to your connection to use those features.

#### 2. Bearer Token

This is a better choice if you need to support multiple Xero accounts at runtime and let the MCP client run an auth flow (such as PKCE). In this case, use the following configuration:

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["insert-your-file-path-here/xero-mcp-server/dist/index.js"],
      "env": {
        "XERO_CLIENT_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

NOTE: The `XERO_CLIENT_BEARER_TOKEN` will take precedence over the `XERO_CLIENT_ID` if defined.

##### Required Scopes for Bearer Token

When obtaining a bearer token, you must request the appropriate scopes:

> **Note:** Some scopes are being deprecated in favour of more granular scopes. See the [Xero OAuth 2.0 Scopes documentation](https://developer.xero.com/documentation/guides/oauth2/scopes/) for details on deprecation timelines.

```
accounting.transactions (Deprecated)
accounting.transactions.read (Deprecated)
accounting.invoices
accounting.invoices.read
accounting.attachments        # required for create-invoice attachmentPath (this fork)
accounting.payments
accounting.payments.read
accounting.banktransactions
accounting.banktransactions.read
accounting.manualjournals
accounting.manualjournals.read
accounting.reports.read (Deprecated)
accounting.reports.aged.read
accounting.reports.balancesheet.read
accounting.reports.profitandloss.read
accounting.reports.trialbalance.read
accounting.contacts
accounting.settings
payroll.settings
payroll.employees
payroll.timesheets
```

## Running this fork

There are two ways to run it. Option A needs no manual clone or build and is how the fork is normally run.

### Option A — run from GitHub with `npx` (recommended)

Point your MCP client straight at the GitHub repo. `npx` fetches it and the `prepare` script builds it on first launch, so there's nothing to clone or compile.

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "github:fredericolawson/xero-mcp-server"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

Add it in Claude Desktop via **Settings > Developer > Edit config**. `XERO_SCOPES` is optional and can be added to `env` to override the default scopes.

> **Updating:** `npx` caches the GitHub spec, so it won't pick up new commits on its own. To pull the latest `main`, clear the cache and restart your client:
> ```bash
> rm -rf ~/.npm/_npx
> ```

### Option B — local build

Clone, build, and point your MCP client at the compiled entry file — useful when developing against the code locally.

```bash
git clone https://github.com/fredericolawson/xero-mcp-server.git
cd xero-mcp-server
npm install
npm run build      # outputs dist/index.js
```

Then add it to Claude Desktop via **Settings > Developer > Edit config**, pointing `args` at the built file:

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["/absolute/path/to/xero-mcp-server/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here",
        "XERO_SCOPES": "accounting.invoices accounting.attachments accounting.contacts accounting.banktransactions accounting.settings"
      }
    }
  }
}
```

`XERO_SCOPES` is optional; if omitted, the default scopes are used. On Windows, escape backslashes in the path, e.g. `"C:\\projects\\xero-mcp-server\\dist\\index.js"`. If you use [nvm](https://github.com/nvm-sh/nvm), set `command` to the full path of the `node` binary.

## Available MCP Commands

Tools marked ✨ are **new in this fork**; tools marked ➕ are **enhanced** beyond the official server (see [What this fork adds](#what-this-fork-adds-over-the-official-xero-mcp) for details).

- `list-accounts`: Retrieve a list of accounts
- ➕ `list-contacts`: Retrieve a list of contacts (adds `where`, `order`, `includeArchived`, `pageSize`, and `summaryOnly=false` for full detail)
- ✨ `get-contact`: Retrieve a single contact by ID, including addresses, phones, contact persons, balances and payment terms
- `list-credit-notes`: Retrieve a list of credit notes
- ➕ `list-invoices`: Retrieve a list of invoices (adds `statuses`, a `where` expression, and `order`; upstream `contactIds`/`invoiceNumbers` still supported)
- `list-items`: Retrieve a list of items
- `list-manual-journals`: Retrieve a list of manual journals
- `list-organisation-details`: Retrieve details about an organisation
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-quotes`: Retrieve a list of quotes
- `list-tax-rates`: Retrieve a list of tax rates
- `list-payments`: Retrieve a list of payments
- `list-trial-balance`: Retrieve a trial balance report
- `list-bank-transactions`: Retrieve a list of bank account transactions
- `list-payroll-employees`: Retrieve a list of Payroll Employees
- `list-report-balance-sheet`: Retrieve a balance sheet report
- `list-payroll-employee-leave`: Retrieve a Payroll Employee's leave records
- `list-payroll-employee-leave-balances`: Retrieve a Payroll Employee's leave balances
- `list-payroll-employee-leave-types`: Retrieve a list of Payroll leave types
- `list-payroll-leave-periods`: Retrieve a list of a Payroll Employee's leave periods
- `list-payroll-leave-types`: Retrieve a list of all available leave types in Xero Payroll
- `list-timesheets`: Retrieve a list of Payroll Timesheets
- `list-aged-receivables-by-contact`: Retrieve aged receivables for a contact
- `list-aged-payables-by-contact`: Retrieve aged payables for a contact
- `list-contact-groups`: Retrieve a list of contact groups
- `list-tracking-categories`: Retrieve a list of tracking categories
- ✨ `list-purchase-orders`: Retrieve a list of purchase orders (filter by `status` and issue-date range)
- ✨ `list-repeating-invoices`: Retrieve recurring invoice/bill templates and their schedules
- ✨ `list-attachments`: List the files attached to a record (invoice/bill, bank transaction, contact, credit note, manual journal, or purchase order)
- ✨ `get-attachment`: Download a named attachment from a record to a local file
- ✨ `list-account-transactions`: Decompose a single account into the individual line items posted to it over a period (from invoices/bills, spend/receive money, credit notes and manual journals), with a net GL movement. A document-level stand-in for the GL — won't perfectly tie to the P&L (system-generated postings like FX/rounding aren't captured)
- `create-bank-transaction`: Create a new bank transaction
- `create-contact`: Create a new contact
- `create-credit-note`: Create a new credit note
- ➕ `create-invoice`: Create a new invoice (adds `currencyCode`, `dueDate`, `status` — DRAFT/SUBMITTED/AUTHORISED — and `attachmentPath` to upload a local file, e.g. the supplier's PDF, onto the new bill; `attachmentPath` requires the `accounting.attachments` scope)
- `create-item`: Create a new item
- `create-manual-journal`: Create a new manual journal
- `create-payment`: Create a new payment
- `create-quote`: Create a new quote
- `create-payroll-timesheet`: Create a new Payroll Timesheet
- `create-tracking-category`: Create a new tracking category
- `create-tracking-option`: Create a new tracking option
- ✨ `create-purchase-order`: Create a new purchase order (DRAFT/SUBMITTED/AUTHORISED)
- ✨ `allocate-credit-note`: Apply (allocate) a credit note to an invoice or bill
- ✨ `upload-attachment`: Upload a local file as an attachment to an existing record (invoice/bill, bank transaction, contact, credit note, manual journal, or purchase order); requires the `accounting.attachments` scope
- `update-bank-transaction`: Update an existing bank transaction
- ➕ `update-contact`: Update an existing contact (adds `defaultCurrency`)
- `update-invoice`: Update an existing draft invoice
- ✨ `void-invoice`: Void an approved invoice/bill (or delete a draft/submitted one)
- ✨ `update-purchase-order`: Update an existing purchase order (or cancel it by setting status to DELETED)
- `update-item`: Update an existing item
- `update-manual-journal`: Update an existing manual journal
- `update-quote`: Update an existing draft quote
- `update-credit-note`: Update an existing draft credit note
- `update-tracking-category`: Update an existing tracking category
- `update-tracking-options`: Update tracking options
- `update-payroll-timesheet-line`: Update a line on an existing Payroll Timesheet
- `approve-payroll-timesheet`: Approve a Payroll Timesheet
- `revert-payroll-timesheet`: Revert an approved Payroll Timesheet
- `add-payroll-timesheet-line`: Add a new line on an existing Payroll Timesheet
- `delete-payroll-timesheet`: Delete an existing Payroll Timesheet
- ✨ `delete-bank-transaction`: Delete a Spend Money / Receive Money bank transaction (sets its status to DELETED; transfers and reconciled transactions are handled in the Xero UI)
- ✨ `delete-payment`: Reverse (delete) a payment, crediting the amount back to the linked invoice
- `get-payroll-timesheet`: Retrieve an existing Payroll Timesheet

For detailed protocol documentation, see the [MCP Protocol Specification](https://modelcontextprotocol.io/).

## For Developers

### Installation

```bash
npm install   # or: pnpm install
```

### Build

```bash
npm run build   # or: pnpm build
```

### Test & lint

```bash
npm test        # vitest
npm run lint    # eslint
```

### Keeping in sync with upstream

This fork tracks the official repo as the `upstream` remote:

```bash
git remote add upstream https://github.com/XeroAPI/xero-mcp-server.git   # one-time
git fetch upstream
git rebase upstream/main    # replay this fork's commits on top of the latest official release
```

## License

MIT

## Security

Please do not commit your `.env` file or any sensitive credentials to version control (it is included in `.gitignore` as a safe default).
