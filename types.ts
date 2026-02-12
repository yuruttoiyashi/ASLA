
export enum AccountType {
  ASSET = '資産',
  LIABILITY = '負債',
  EQUITY = '純資産',
  REVENUE = '収益',
  EXPENSE = '費用'
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isStandard?: boolean;
}

export interface JournalEntry {
  accountId: string;
  amount: number;
  description: string;
}

export interface Voucher {
  id: string;
  date: string;
  debitEntries: JournalEntry[];
  creditEntries: JournalEntry[];
  description: string;
  createdAt: number;
}

export type TabType = 'entry' | 'ledger' | 'tb' | 'fs' | 'settings';
