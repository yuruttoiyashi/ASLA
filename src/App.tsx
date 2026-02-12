
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// ==========================================
// 1. 型定義 (Types)
// ==========================================

enum AccountType {
  ASSET = '資産',
  LIABILITY = '負債',
  EQUITY = '純資産',
  REVENUE = '収益',
  EXPENSE = '費用'
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isStandard?: boolean;
}

interface JournalEntry {
  accountId: string;
  amount: number;
  description: string;
}

interface Voucher {
  id: string;
  date: string;
  debitEntries: JournalEntry[];
  creditEntries: JournalEntry[];
  description: string;
  createdAt: number;
}

type TabType = 'entry' | 'ledger' | 'tb' | 'fs' | 'settings';

// ==========================================
// 2. 定数・初期データ (Constants & Initial Data)
// ==========================================

const INITIAL_ACCOUNTS: Account[] = [
  { id: '101', code: '1101', name: '現金', type: AccountType.ASSET, isStandard: true },
  { id: '102', code: '1102', name: '普通預金', type: AccountType.ASSET, isStandard: true },
  { id: '103', code: '1103', name: '売掛金', type: AccountType.ASSET, isStandard: true },
  { id: '104', code: '1201', name: '車両運搬具', type: AccountType.ASSET, isStandard: true },
  { id: '201', code: '2101', name: '買掛金', type: AccountType.LIABILITY, isStandard: true },
  { id: '202', code: '2102', name: '未払金', type: AccountType.LIABILITY, isStandard: true },
  { id: '203', code: '2201', name: '借入金', type: AccountType.LIABILITY, isStandard: true },
  { id: '301', code: '3101', name: '資本金', type: AccountType.EQUITY, isStandard: true },
  { id: '401', code: '4101', name: '運送収入', type: AccountType.REVENUE, isStandard: true },
  { id: '501', code: '5101', name: '燃料費', type: AccountType.EXPENSE, isStandard: true },
  { id: '502', code: '5102', name: '高速道路利用料', type: AccountType.EXPENSE, isStandard: true },
  { id: '503', code: '5103', name: '車両保守費', type: AccountType.EXPENSE, isStandard: true },
  { id: '504', code: '5104', name: '荷造運賃', type: AccountType.EXPENSE, isStandard: true },
  { id: '505', code: '5105', name: '外注費', type: AccountType.EXPENSE, isStandard: true },
  { id: '506', code: '5106', name: '給与手当', type: AccountType.EXPENSE, isStandard: true },
];

// ==========================================
// 3. ユーティリティ (Utilities)
// ==========================================

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ja-JP').format(num);
};

const parseNumber = (val: string): number => {
  const sanitized = val.replace(/[^0-9]/g, '');
  return sanitized === '' ? 0 : parseInt(sanitized, 10);
};

// ==========================================
// 4. コンポーネント (Sub-Components)
// ==========================================

/**
 * 数値入力フィールド: カンマ区切り表示と数値処理を両立
 */
const AmountInput: React.FC<{ value: number, onChange: (val: number) => void, focusColor?: string }> = ({ value, onChange, focusColor = "blue" }) => {
  const [displayValue, setDisplayValue] = useState(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const numeric = parseNumber(raw);
    setDisplayValue(formatNumber(numeric));
    onChange(numeric);
  };

  return (
    <div className="relative w-full">
      <input 
        type="text" 
        value={displayValue === '0' ? '' : displayValue} 
        onChange={handleChange}
        placeholder="0"
        className={`w-full border-2 border-slate-200 rounded-lg p-2 text-right font-mono font-bold focus:ring-2 focus:ring-${focusColor}-400 focus:border-${focusColor}-400 outline-none transition-all`}
      />
      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold pointer-events-none">JPY</span>
    </div>
  );
};

// ==========================================
// 5. メインApp (Main Application)
// ==========================================

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('entry');
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY || '' }), []);

  const addVoucher = (v: Voucher) => setVouchers(prev => [v, ...prev]);

  const handleReverse = (v: Voucher) => {
    const reversed: Voucher = {
      ...v,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      debitEntries: v.creditEntries.map(e => ({ ...e })),
      creditEntries: v.debitEntries.map(e => ({ ...e })),
      description: `【反対仕訳】${v.description}`,
      createdAt: Date.now(),
    };
    addVoucher(reversed);
    alert('反対仕訳を生成しました。');
  };

  const suggestAccount = async (description: string, isDebit: boolean) => {
    if (!description) return;
    setAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `以下の取引内容から最適な勘定科目を1つ推測してください。
摘要: "${description}"
候補: ${accounts.map(a => a.name).join(', ')}
JSON形式: {"accountName": "科目名"}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { accountName: { type: Type.STRING } }
          }
        }
      });
      const data = JSON.parse(response.text || '{}');
      return accounts.find(a => a.name === data.accountName);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const getManagementAdvice = async (tbData: any[]) => {
    setAiLoading(true);
    setAiAdvice(null);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `物流会社の試算表データを分析し、経営改善アドバイスを3点箇条書きで出してください。
データ: ${JSON.stringify(tbData)}`,
        config: { systemInstruction: "物流専門の経営コンサルタントとして分析してください。" }
      });
      setAiAdvice(response.text || "解析できませんでした。");
    } catch (e) {
      console.error(e);
      setAiAdvice("AIエラーが発生しました。");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-slate-900 text-white shadow-2xl sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <i className="fas fa-truck-moving text-blue-400"></i> ASLA
              <span className="text-xs font-normal text-slate-500 hidden sm:inline ml-2 uppercase tracking-widest">Logistics ERP</span>
            </h1>
            <nav className="flex space-x-0.5">
              {[
                { id: 'entry', label: '伝票入力', icon: 'fa-file-invoice' },
                { id: 'ledger', label: '総勘定元帳', icon: 'fa-book' },
                { id: 'tb', label: '試算表', icon: 'fa-table' },
                { id: 'fs', label: '決算書', icon: 'fa-chart-pie' },
                { id: 'settings', label: '設定', icon: 'fa-cog' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-2 rounded-t-lg transition-all text-sm font-bold flex items-center gap-2 border-b-4 ${
                    activeTab === tab.id ? 'bg-white text-slate-900 border-blue-500' : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800'
                  }`}
                >
                  <i className={`fas ${tab.icon}`}></i> {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 max-w-7xl animate-in fade-in duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[700px]">
          {activeTab === 'entry' && (
            <VoucherEntryView accounts={accounts} onAddVoucher={addVoucher} suggestAccount={suggestAccount} aiLoading={aiLoading} recentVouchers={vouchers} onReverse={handleReverse} />
          )}
          {activeTab === 'ledger' && <GeneralLedgerView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'tb' && <TrialBalanceView vouchers={vouchers} accounts={accounts} onGetAdvice={getManagementAdvice} aiLoading={aiLoading} advice={aiAdvice} />}
          {activeTab === 'fs' && <FinancialStatementsView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'settings' && <SettingsView accounts={accounts} setAccounts={setAccounts} />}
        </div>
      </main>

      <footer className="py-6 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        &copy; 2025 ASLA Logistics Systems - Professional Edition
      </footer>
    </div>
  );
};

// ==========================================
// 6. 各タブのビュー (View Components)
// ==========================================

/**
 * 伝票入力ビュー: 左右完全分割
 */
const VoucherEntryView: React.FC<{ 
  accounts: Account[], 
  onAddVoucher: (v: Voucher) => void, 
  suggestAccount: (d: string, b: boolean) => Promise<Account | undefined>,
  aiLoading: boolean,
  recentVouchers: Voucher[],
  onReverse: (v: Voucher) => void
}> = ({ accounts, onAddVoucher, suggestAccount, aiLoading, recentVouchers, onReverse }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState('');
  const [debits, setDebits] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
  const [credits, setCredits] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);

  const update = (side: 'd' | 'c', i: number, f: keyof JournalEntry, v: any) => {
    const s = side === 'd' ? setDebits : setCredits;
    s(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [f]: v };
      return next;
    });
  };

  const totalD = debits.reduce((s, e) => s + e.amount, 0);
  const totalC = credits.reduce((s, e) => s + e.amount, 0);
  const isBalanced = totalD > 0 && totalD === totalC;

  const handleSubmit = () => {
    if (!isBalanced) return alert('貸借不一致または0円です。');
    onAddVoucher({ id: Date.now().toString(), date, description: desc, debitEntries: debits, creditEntries: credits, createdAt: Date.now() });
    setDesc('');
    setDebits([{ accountId: accounts[0].id, amount: 0, description: '' }]);
    setCredits([{ accountId: accounts[0].id, amount: 0, description: '' }]);
    alert('伝票を登録しました。');
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap gap-6 mb-8 border-b pb-6 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Transaction Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border-2 border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div className="flex-grow space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Journal Description</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="例：4月分傭車代支払（XX運送）" className="w-full border-2 border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10">
        {/* DEBIT SIDE */}
        <div className="space-y-4">
          <div className="bg-blue-600 text-white p-3 rounded-xl flex justify-between items-center shadow-lg">
            <span className="font-black text-lg">借方 (DEBIT)</span>
            <span className="font-mono font-bold text-xl">{formatNumber(totalD)}</span>
          </div>
          {debits.map((e, i) => (
            <div key={i} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-xl space-y-3 relative transition-all hover:border-blue-200">
              <div className="flex gap-2">
                <select value={e.accountId} onChange={x => update('d', i, 'accountId', x.target.value)} className="flex-grow border-2 border-slate-200 rounded-lg p-2 text-sm font-bold bg-white outline-none">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-40"><AmountInput value={e.amount} onChange={v => update('d', i, 'amount', v)} /></div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={x => update('d', i, 'description', x.target.value)} placeholder="明細摘要（個別）" className="flex-grow border-2 border-slate-100 rounded-lg p-1.5 text-xs bg-white focus:border-blue-300 outline-none" />
                <button 
                  onClick={async () => { const a = await suggestAccount(e.description || desc, true); if(a) update('d', i, 'accountId', a.id); }} 
                  className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold shadow hover:bg-blue-700 transition-all disabled:opacity-50"
                  disabled={aiLoading}
                >
                  {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : 'AI推論'}
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setDebits([...debits, { accountId: accounts[0].id, amount: 0, description: '' }])} className="w-full py-2 border-2 border-dashed border-blue-200 text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">+ 行を追加</button>
        </div>

        {/* CREDIT SIDE */}
        <div className="space-y-4">
          <div className="bg-orange-600 text-white p-3 rounded-xl flex justify-between items-center shadow-lg">
            <span className="font-black text-lg">貸方 (CREDIT)</span>
            <span className="font-mono font-bold text-xl">{formatNumber(totalC)}</span>
          </div>
          {credits.map((e, i) => (
            <div key={i} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-xl space-y-3 relative transition-all hover:border-orange-200">
              <div className="flex gap-2">
                <select value={e.accountId} onChange={x => update('c', i, 'accountId', x.target.value)} className="flex-grow border-2 border-slate-200 rounded-lg p-2 text-sm font-bold bg-white outline-none">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-40"><AmountInput value={e.amount} onChange={v => update('c', i, 'amount', v)} focusColor="orange" /></div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={x => update('c', i, 'description', x.target.value)} placeholder="明細摘要（個別）" className="flex-grow border-2 border-slate-100 rounded-lg p-1.5 text-xs bg-white focus:border-orange-300 outline-none" />
                <button 
                  onClick={async () => { const a = await suggestAccount(e.description || desc, false); if(a) update('c', i, 'accountId', a.id); }} 
                  className="bg-orange-600 text-white px-3 py-1 rounded text-[10px] font-bold shadow hover:bg-orange-700 transition-all disabled:opacity-50"
                  disabled={aiLoading}
                >
                  {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : 'AI推論'}
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setCredits([...credits, { accountId: accounts[0].id, amount: 0, description: '' }])} className="w-full py-2 border-2 border-dashed border-orange-200 text-orange-400 rounded-xl text-sm font-bold hover:bg-orange-50 transition-colors">+ 行を追加</button>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <button 
          onClick={handleSubmit} 
          disabled={!isBalanced}
          className={`px-24 py-5 rounded-full font-black text-2xl shadow-2xl transition-all transform active:scale-95 ${
            isBalanced ? 'bg-slate-900 text-white hover:bg-black hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isBalanced ? '仕訳を確定する' : '貸借を一致させてください'}
        </button>
        {totalD !== totalC && totalD > 0 && totalC > 0 && (
          <p className="text-red-500 font-bold animate-pulse text-sm">※貸借差額：{formatNumber(Math.abs(totalD - totalC))}円</p>
        )}
      </div>

      <div className="mt-20">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded-full"></div> 最近の仕訳（クリックで反対仕訳が可能）
        </h3>
        <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-left">日付</th>
                <th className="p-4 text-left">内容</th>
                <th className="p-4 text-right">金額</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentVouchers.slice(0, 5).map(v => (
                <tr key={v.id} className="hover:bg-slate-50 group">
                  <td className="p-4 font-mono text-slate-500">{v.date}</td>
                  <td className="p-4 font-bold">{v.description}</td>
                  <td className="p-4 text-right font-mono font-bold text-slate-800">{formatNumber(v.debitEntries.reduce((s, e) => s + e.amount, 0))}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => onReverse(v)} className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold border border-red-200 hover:bg-red-600 hover:text-white transition-all">
                      反対仕訳作成
                    </button>
                  </td>
                </tr>
              ))}
              {recentVouchers.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">取引データがまだありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * 総勘定元帳ビュー: 特定科目の取引履歴
 */
const GeneralLedgerView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id || '');
  
  const entries = useMemo(() => {
    const list: any[] = [];
    let balance = 0;
    const sorted = [...vouchers].sort((a, b) => a.date.localeCompare(b.date));
    const target = accounts.find(a => a.id === selectedId);
    if (!target) return [];

    sorted.forEach(v => {
      v.debitEntries.forEach(e => {
        if (e.accountId === selectedId) {
          const isAssetExp = target.type === AccountType.ASSET || target.type === AccountType.EXPENSE;
          balance += isAssetExp ? e.amount : -e.amount;
          list.push({ date: v.date, desc: e.description || v.description, debit: e.amount, credit: 0, balance });
        }
      });
      v.creditEntries.forEach(e => {
        if (e.accountId === selectedId) {
          const isAssetExp = target.type === AccountType.ASSET || target.type === AccountType.EXPENSE;
          balance += isAssetExp ? -e.amount : e.amount;
          list.push({ date: v.date, desc: e.description || v.description, debit: 0, credit: e.amount, balance });
        }
      });
    });
    return list;
  }, [vouchers, selectedId, accounts]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800">総勘定元帳</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">General Ledger</p>
        </div>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="border-2 border-slate-200 rounded-xl px-6 py-3 font-bold bg-white outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
        </select>
      </div>

      <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-4 text-left w-32">日付</th>
              <th className="p-4 text-left">摘要</th>
              <th className="p-4 text-right w-32">借方 (Debit)</th>
              <th className="p-4 text-right w-32">貸方 (Credit)</th>
              <th className="p-4 text-right w-40 bg-slate-800">残高</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((x, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors font-mono">
                <td className="p-4 font-sans text-slate-500">{x.date}</td>
                <td className="p-4 font-sans text-slate-700">{x.desc}</td>
                <td className="p-4 text-right text-blue-600 font-bold">{x.debit ? formatNumber(x.debit) : '-'}</td>
                <td className="p-4 text-right text-orange-600 font-bold">{x.credit ? formatNumber(x.credit) : '-'}</td>
                <td className={`p-4 text-right font-black bg-slate-50 ${x.balance < 0 ? 'text-red-500' : 'text-slate-900'}`}>{formatNumber(x.balance)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic">取引履歴がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 合計残高試算表ビュー
 */
const TrialBalanceView: React.FC<{ vouchers: Voucher[], accounts: Account[], onGetAdvice: (d: any[]) => void, aiLoading: boolean, advice: string | null }> = ({ vouchers, accounts, onGetAdvice, aiLoading, advice }) => {
  const tb = useMemo(() => {
    return accounts.map(acc => {
      let d = 0, c = 0;
      vouchers.forEach(v => {
        v.debitEntries.forEach(e => { if(e.accountId === acc.id) d += e.amount; });
        v.creditEntries.forEach(e => { if(e.accountId === acc.id) c += e.amount; });
      });
      const b = (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) ? d - c : c - d;
      return { code: acc.code, name: acc.name, d, c, b };
    }).filter(x => x.d !== 0 || x.c !== 0);
  }, [vouchers, accounts]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-800">合計残高試算表</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Trial Balance</p>
        </div>
        <button onClick={() => onGetAdvice(tb)} disabled={aiLoading || tb.length === 0} className="bg-gradient-to-br from-indigo-700 to-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-xl hover:shadow-indigo-200 transition-all flex items-center gap-2">
          {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          AIで経営状態を分析
        </button>
      </div>

      {advice && (
        <div className="mb-10 bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <h3 className="text-indigo-900 font-black mb-4 flex items-center gap-2">
            <i className="fas fa-robot text-lg"></i> AI経営診断結果
          </h3>
          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">{advice}</div>
        </div>
      )}

      <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-md">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-4 text-left">コード</th>
              <th className="p-4 text-left">勘定科目名称</th>
              <th className="p-4 text-right">借方合計</th>
              <th className="p-4 text-right">貸方合計</th>
              <th className="p-4 text-right bg-slate-800">差引残高</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-sm">
            {tb.map((x, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-400 font-sans">{x.code}</td>
                <td className="p-4 font-bold text-slate-800 font-sans">{x.name}</td>
                <td className="p-4 text-right text-blue-700 font-bold">{formatNumber(x.d)}</td>
                <td className="p-4 text-right text-orange-700 font-bold">{formatNumber(x.c)}</td>
                <td className="p-4 text-right font-black bg-slate-50 text-slate-900">{formatNumber(x.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 決算報告書ビュー
 */
const FinancialStatementsView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => {
  const data = useMemo(() => {
    let revenue = 0, expense = 0, asset = 0, liability = 0, equity = 0;
    const pl: any[] = [], bs: any[] = [];
    
    accounts.forEach(acc => {
      let d = 0, c = 0;
      vouchers.forEach(v => {
        v.debitEntries.forEach(e => { if(e.accountId === acc.id) d += e.amount; });
        v.creditEntries.forEach(e => { if(e.accountId === acc.id) c += e.amount; });
      });
      const bal = (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) ? d - c : c - d;
      if (bal === 0) return;

      if (acc.type === AccountType.REVENUE || acc.type === AccountType.EXPENSE) {
        pl.push({ name: acc.name, bal, type: acc.type });
        if (acc.type === AccountType.REVENUE) revenue += bal; else expense += bal;
      } else {
        bs.push({ name: acc.name, bal, type: acc.type });
        if (acc.type === AccountType.ASSET) asset += bal;
        else if (acc.type === AccountType.LIABILITY) liability += bal;
        else equity += bal;
      }
    });
    const netIncome = revenue - expense;
    return { pl, bs, netIncome, asset, liability, equity };
  }, [vouchers, accounts]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-black text-slate-800 mb-10 border-b pb-4">決算報告書 (P/L & B/S)</h2>
      <div className="grid grid-cols-2 gap-12">
        {/* P/L */}
        <div className="bg-slate-50 p-8 rounded-3xl border-2 border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-indigo-900 mb-6 flex items-center gap-2">
            <i className="fas fa-file-invoice-dollar"></i> 損益計算書 (P/L)
          </h3>
          <div className="space-y-3 font-mono text-sm">
            {data.pl.map((x, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-white">
                <span className={x.type === AccountType.REVENUE ? 'font-bold text-blue-700' : ''}>{x.name}</span>
                <span className="font-bold">{formatNumber(x.bal)}</span>
              </div>
            ))}
            <div className="mt-10 p-5 bg-indigo-900 text-white rounded-2xl flex justify-between items-center shadow-xl">
              <span className="font-bold">当期純利益</span>
              <span className="text-2xl font-black underline decoration-4 underline-offset-4">{formatNumber(data.netIncome)}</span>
            </div>
          </div>
        </div>

        {/* B/S */}
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-green-900 mb-6 flex items-center gap-2">
            <i className="fas fa-balance-scale"></i> 貸借対照表 (B/S)
          </h3>
          <div className="space-y-6 font-mono text-sm">
            <section>
              <h4 className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded w-fit mb-3 uppercase tracking-widest">Assets</h4>
              {data.bs.filter(x => x.type === AccountType.ASSET).map((x, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-slate-50">
                  <span>{x.name}</span>
                  <span className="font-bold">{formatNumber(x.bal)}</span>
                </div>
              ))}
            </section>
            <section>
              <h4 className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit mb-3 uppercase tracking-widest">Liabilities & Equity</h4>
              {data.bs.filter(x => x.type !== AccountType.ASSET).map((x, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-slate-50">
                  <span>{x.name}</span>
                  <span className="font-bold">{formatNumber(x.bal)}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 px-2 bg-slate-50 border-l-4 border-indigo-500 mt-2 font-bold">
                <span className="text-indigo-800 italic">Net Income Ref.</span>
                <span className="text-indigo-800">{formatNumber(data.netIncome)}</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 設定・科目ビュー
 */
const SettingsView: React.FC<{ accounts: Account[], setAccounts: React.Dispatch<React.SetStateAction<Account[]>> }> = ({ accounts, setAccounts }) => {
  const [newAcc, setNewAcc] = useState({ code: '', name: '', type: AccountType.EXPENSE });

  const add = () => {
    if (!newAcc.code || !newAcc.name) return alert('入力が不足しています。');
    if (accounts.find(a => a.code === newAcc.code)) return alert('コードが重複しています。');
    setAccounts(prev => [...prev, { ...newAcc, id: Date.now().toString() }].sort((a,b) => a.code.localeCompare(b.code)));
    setNewAcc({ code: '', name: '', type: AccountType.EXPENSE });
  };

  const remove = (id: string) => {
    if (!confirm('削除しますか？')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-black text-slate-800 mb-8 border-b pb-4">設定・勘定科目マスター</h2>
      <div className="bg-slate-900 p-8 rounded-3xl text-white mb-10 shadow-2xl">
        <h3 className="text-blue-400 font-black mb-6 flex items-center gap-2">
          <i className="fas fa-plus-circle"></i> 新規科目の追加（物流特有科目など）
        </h3>
        <div className="grid grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Account Code</label>
            <input type="text" value={newAcc.code} onChange={e => setNewAcc({...newAcc, code: e.target.value})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="5201" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Account Name</label>
            <input type="text" value={newAcc.name} onChange={e => setNewAcc({...newAcc, name: e.target.value})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="車両保険料" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Category</label>
            <select value={newAcc.type} onChange={e => setNewAcc({...newAcc, type: e.target.value as AccountType})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              {Object.values(AccountType).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={add} className="bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg active:scale-95">マスター登録</button>
        </div>
      </div>

      <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 text-left w-24">コード</th>
              <th className="p-4 text-left">名称</th>
              <th className="p-4 text-left">区分</th>
              <th className="p-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {accounts.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 group transition-colors">
                <td className="p-4 text-slate-500">{a.code}</td>
                <td className="p-4 font-bold text-slate-800">{a.name}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    a.type === AccountType.ASSET ? 'bg-green-100 text-green-700' :
                    a.type === AccountType.LIABILITY ? 'bg-amber-100 text-amber-700' :
                    a.type === AccountType.REVENUE ? 'bg-blue-100 text-blue-700' :
                    a.type === AccountType.EXPENSE ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                  }`}>{a.type}</span>
                </td>
                <td className="p-4 text-center">
                  {!a.isStandard && (
                    <button onClick={() => remove(a.id)} className="text-red-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  )}
                  {a.isStandard && <span className="text-[10px] text-slate-300 font-bold tracking-widest uppercase">Fixed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
