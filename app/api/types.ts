// Formas de la API. El contrato OpenAPI no tipa cuerpos (deuda D-7), así que
// esto refleja los handlers de api-go en la fecha de la integración.

export type Meta = {
  request_id?: string;
  page?: {
    has_more?: boolean;
    next_cursor?: string | null;
    limit?: number;
    total?: number;
  };
};

export type Envelope<T> = {
  data: T;
  meta?: Meta;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at?: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  user: User;
};

export type Company = {
  id: string;
  rif_rut: string;
  legal_name: string;
  trade_name: string | null;
  fiscal_address: string | null;
  phone: string | null;
  email: string | null;
  currency_code: string;
  is_active: boolean;
};

export type Access = {
  company_id: string;
  role: Role;
  permissions: string[];
};

export type Role =
  | "CONTADOR_PRINCIPAL"
  | "CONTADOR_SECUNDARIO"
  | "ASISTENTE"
  | "CLIENTE";

export type FiscalYear = {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  is_closed: boolean;
};

export type FiscalPeriod = {
  id: string;
  year: number;
  month: number;
  label: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at: string | null;
};

export type Classification =
  | "ACTIVO"
  | "PASIVO"
  | "PATRIMONIO"
  | "INGRESO"
  | "COSTO"
  | "GASTO"
  | "ORDEN";

export type Nature = "DEUDORA" | "ACREEDORA";

export type Account = {
  id: string;
  code: string;
  name: string;
  classification: Classification;
  nature: Nature;
  level: number;
  parent_id: string | null;
  is_postable: boolean;
  is_active: boolean;
};

export type EntryType = "INGRESO" | "EGRESO" | "DIARIO" | "AJUSTE" | "CIERRE";
export type EntryStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type EntryLine = {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  line_number: number;
  description: string | null;
  debit: string;
  credit: string;
};

export type Entry = {
  id: string;
  number: number;
  entry_date: string;
  entry_type: EntryType;
  description: string;
  reference: string | null;
  status: EntryStatus;
  fiscal_period_id: string;
  lines: EntryLine[];
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
  posted_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type ReportPeriod = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
};

export type StatementLine = {
  code: string;
  name: string;
  classification: Classification;
  nature: Nature;
  amount: string;
};

export type BalanceReport = {
  kind: "balance";
  period: ReportPeriod;
  rows: {
    code: string;
    name: string;
    classification: Classification;
    nature: Nature;
    debit: string;
    credit: string;
    balance: string;
  }[];
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
};

export type IncomeReport = {
  kind: "estado-resultados";
  period: ReportPeriod;
  income: StatementLine[];
  expenses: StatementLine[];
  total_income: string;
  total_expenses: string;
  net_result: string;
};

export type SituationReport = {
  kind: "estado-situacion";
  period: ReportPeriod;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
  net_result: string;
  is_balanced: boolean;
};

export type SyncReport = BalanceReport | IncomeReport | SituationReport;
export type ReportKind = SyncReport["kind"];

export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING";

export type Job = {
  job_id: string;
  type: string;
  status: JobStatus;
  progress: number;
  attempts: number;
  result: unknown;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type DownloadLink = {
  url: string;
  file_name: string;
  content_type: string;
  expires_in: number;
};

export type BankAccount = {
  id: string;
  account_id: string;
  bank_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
};

export type BankStatement = {
  id: string;
  bank_account_id: string;
  bank_name: string;
  account_number: string;
  currency: string;
  file_name: string;
  statement_date: string;
  initial_balance: string;
  final_balance: string;
  transaction_count: number;
  pending_count: number;
  matched_count: number;
  discrepancy_count: number;
  uploaded_at: string;
};

export type BankTransactionStatus = "PENDING" | "MATCHED" | "DISCREPANCY";

export type Suggestion = {
  line_id: string;
  entry_id: string;
  entry_number: number;
  entry_date: string;
  entry_reference: string | null;
  entry_description: string;
  line_description: string | null;
  debit: string;
  credit: string;
  reference_exact: boolean;
  days_apart: number;
  ambiguous: boolean;
};

export type BankTransaction = {
  id: string;
  statement_id: string;
  transaction_date: string;
  reference: string | null;
  description: string | null;
  amount: string;
  status: BankTransactionStatus;
  matched_line_id: string | null;
  match_source: "AUTO" | "MANUAL" | null;
  reconciled_at: string | null;
  suggestion: Suggestion | null;
};

export type Page<T> = { items: T[]; meta?: Meta };
