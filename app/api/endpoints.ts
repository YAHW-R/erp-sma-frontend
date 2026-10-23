import type {
  Access,
  Account,
  BankAccount,
  BankStatement,
  BankTransaction,
  Classification,
  Company,
  DownloadLink,
  Entry,
  EntryStatus,
  EntryType,
  FiscalPeriod,
  FiscalYear,
  Job,
  Nature,
  SyncReport,
} from "~/api/types";
import { blob, del, get, page, patch, post, put, upload } from "~/lib/api";

const company = (id: string) => `/companies/${id}`;

// --- Empresas y accesos ----------------------------------------------------

export const companies = () => get<Company[]>("/companies", { query: { limit: 200 } });
export const accesses = (userId: string) => get<Access[]>(`/admin/users/${userId}/access`);

// --- Períodos fiscales -----------------------------------------------------

export const fiscalYears = (companyId: string) => get<FiscalYear[]>(`${company(companyId)}/fiscal-years`);

export const fiscalPeriods = (companyId: string, year?: number) =>
  get<FiscalPeriod[]>(`${company(companyId)}/fiscal-periods`, { query: { year } });

export const createFiscalYear = (companyId: string, year: number) =>
  post<FiscalYear>(`${company(companyId)}/fiscal-years`, { year });

export const closePeriod = (periodId: string) => post<FiscalPeriod>(`/fiscal-periods/${periodId}/close`);

export const reopenPeriod = (periodId: string, reason: string) =>
  post<FiscalPeriod>(`/fiscal-periods/${periodId}/reopen`, { reason });

// --- Catálogo --------------------------------------------------------------

export type AccountInput = {
  code: string;
  name: string;
  classification: Classification;
  nature: Nature;
  parent_id?: string | null;
};

export type AccountUpdate = {
  name?: string;
  classification?: Classification;
  nature?: Nature;
  is_active?: boolean;
};

export const accounts = (companyId: string, query?: { search?: string; classification?: string }) =>
  page<Account>(`${company(companyId)}/accounts`, { query: { all: 1, limit: 200, ...query } });

export const createAccount = (companyId: string, input: AccountInput) =>
  post<Account>(`${company(companyId)}/accounts`, input);

export const updateAccount = (companyId: string, accountId: string, input: AccountUpdate) =>
  patch<Account>(`${company(companyId)}/accounts/${accountId}`, input);

export const deleteAccount = (companyId: string, accountId: string) =>
  del<{ status: string }>(`${company(companyId)}/accounts/${accountId}`);

export const seedTemplate = (companyId: string, setName?: string) =>
  post<{ status: string; accounts: number }>(`${company(companyId)}/accounts/seed-template`, undefined, {
    query: { set: setName },
  });

export const exportAccounts = (companyId: string) => blob(`/companies/${companyId}/accounts/export`);

// --- Asientos --------------------------------------------------------------

export type EntryLineInput = {
  account_id: string;
  description?: string;
  debit: string;
  credit: string;
};

export type EntryInput = {
  entry_date: string;
  entry_type: EntryType;
  description: string;
  reference?: string;
  lines: EntryLineInput[];
};

export type EntryFilters = {
  search?: string;
  period_id?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export const entries = (companyId: string, filters: EntryFilters = {}) =>
  page<Entry>(`${company(companyId)}/entries`, { query: filters });

export const entry = (companyId: string, entryId: string) => get<Entry>(`${company(companyId)}/entries/${entryId}`);

export const createEntry = (companyId: string, input: EntryInput) =>
  post<Entry>(`${company(companyId)}/entries`, input);

export const postEntry = (companyId: string, entryId: string) =>
  post<Entry>(`${company(companyId)}/entries/${entryId}/post`);

export const cancelEntry = (companyId: string, entryId: string, reason: string) =>
  post<Entry>(`${company(companyId)}/entries/${entryId}/cancel`, { reason });

export const duplicateEntry = (companyId: string, entryId: string, entryDate: string) =>
  post<Entry>(`${company(companyId)}/entries/${entryId}/duplicate`, { entry_date: entryDate });

// --- Reportes --------------------------------------------------------------

export const syncReport = (companyId: string, kind: string, periodId: string) =>
  get<SyncReport>(`${company(companyId)}/reports/${kind}`, { query: { period_id: periodId } });

export type ReportRequest = {
  period_id: string;
  format: "pdf" | "xlsx";
  account_id?: string;
  bank_account_id?: string;
};

export const requestReport = (companyId: string, kind: string, input: ReportRequest) =>
  post<{ job_id: string; type: string; status: string }>(`${company(companyId)}/reports/${kind}`, input);

export const job = (companyId: string, jobId: string) => get<Job>(`${company(companyId)}/jobs/${jobId}`);

export const jobDownload = (companyId: string, jobId: string) =>
  get<DownloadLink>(`${company(companyId)}/jobs/${jobId}/download`);

// --- Banco -----------------------------------------------------------------

export const bankAccounts = (companyId: string) =>
  get<BankAccount[]>(`${company(companyId)}/bank-accounts`, { query: { all: 1 } });

export const createBankAccount = (
  companyId: string,
  input: { account_id: string; bank_name: string; account_number: string; currency: string },
) => post<BankAccount>(`${company(companyId)}/bank-accounts`, input);

export const bankStatements = (companyId: string, query?: { bank_account_id?: string; from_date?: string; to_date?: string }) =>
  page<BankStatement>(`${company(companyId)}/bank-statements`, { query: { limit: 50, ...query } });

export const bankStatement = (companyId: string, statementId: string) =>
  get<BankStatement>(`${company(companyId)}/bank-statements/${statementId}`);

export const statementTransactions = (
  companyId: string,
  statementId: string,
  status?: string,
) =>
  page<BankTransaction>(`${company(companyId)}/bank-statements/${statementId}/transactions`, {
    query: { limit: 200, status },
  });

export const uploadStatement = (companyId: string, form: FormData) =>
  upload<BankStatement>(`${company(companyId)}/bank-statements`, form);

export const reconcileStatement = (companyId: string, statementId: string) =>
  post<{ job_id: string; status: string }>(`${company(companyId)}/bank-transactions/reconcile`, {
    statement_id: statementId,
  });

export const matchTransaction = (companyId: string, transactionId: string, lineId: string) =>
  put<unknown>(`${company(companyId)}/bank-transactions/${transactionId}/match`, { line_id: lineId });

export const unmatchTransaction = (companyId: string, transactionId: string) =>
  del<unknown>(`${company(companyId)}/bank-transactions/${transactionId}/match`);

export const discardTransaction = (companyId: string, transactionId: string) =>
  post<unknown>(`${company(companyId)}/bank-transactions/${transactionId}/discard`);

// --- Banderas de estado ----------------------------------------------------

export const ENTRY_STATUS_OPTIONS: Array<[EntryStatus, string]> = [
  ["DRAFT", "Borrador"],
  ["POSTED", "Publicado"],
  ["CANCELLED", "Anulado"],
];
