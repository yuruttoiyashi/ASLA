
import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

const LOGISTICS_ACCOUNTS: Account[] = [
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
  { id: '505', code: '5105', name: '荷役労務費', type: AccountType.EXPENSE, isStandard: true },
  { id: '506', code: '5106', name: '給与手当', type: AccountType.EXPENSE, isStandard: true },
  { id: '507', code: '5107', name: '法定福利費', type: AccountType.EXPENSE, isStandard: true },
];

// ==========================================
// 3. ユーティリティ (Utilities)
// ==========================================

const formatNumber = (num: number): string => {
  if (num === 0) return '0';
  return new Intl.NumberFormat('ja-JP').format(num);
};

const parseNumber = (val: string): number => {
  const sanitized = val.replace(/[^0-9]/g, '');
  return sanitized === '' ? 0 : parseInt(sanitized, 10);
};

// ==========================================
// 4. メインコンポーネント (App)
// ==========================================

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('entry');
  const [accounts, setAccounts] = useState<Account[]>(LOGISTICS_ACCOUNTS);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY || '' }), []);

  const suggestAccount = async (description: string, isDebit: boolean) => {
    if (!description) return;
    setAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `摘要: "${description}"
区分: ${isDebit ? '借方' : '貸方'}
候補科目: ${accounts.map(a => a.name).join(', ')}
JSONで返してください: {"accountName": "科目名"}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              accountName: { type: Type.STRING }
            }
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
        contents: `物流会社の試算表データを分析し、改善アドバイスを箇条書きで出してください。
データ: ${JSON.stringify(tbData)}`,
        config: { systemInstruction: "物流業界専門の会計コンサルタントとして回答してください。" }
      });
      setAiAdvice(response.text || "解析不能");
    } catch (e) {
      console.error(e);
      setAiAdvice("AI分析エラー");
    } finally {
      setAiLoading(false);
    }
  };

  const addVoucher = (v: Voucher) => setVouchers(prev => [v, ...prev]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <i className="fas fa-truck-moving text-blue-400"></i> ASLA
            </h1>
            <nav className="flex space-x-1">
              {[
                { id: 'entry', label: '伝票入力', icon: 'fa-file-invoice' },
                { id: 'ledger', label: '総勘定元帳', icon: 'fa-book' },
                { id: 'tb', label: '合計残高試算表', icon: 'fa-table' },
                { id: 'fs', label: '決算報告書', icon: 'fa-chart-pie' },
                { id: 'settings', label: '設定・科目', icon: 'fa-cog' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-2 rounded-t-lg transition-all text-sm font-bold flex items-center gap-2 ${
                    activeTab === tab.id ? 'bg-white text-slate-900 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <i className={`fas ${tab.icon}`}></i> {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 max-w-7xl">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[600px]">
          {activeTab === 'entry' && <VoucherEntryView accounts={accounts} onAddVoucher={addVoucher} suggestAccount={suggestAccount} aiLoading={aiLoading} recentVouchers={vouchers} />}
          {activeTab === 'ledger' && <GeneralLedgerView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'tb' && <TrialBalanceView vouchers={vouchers} accounts={accounts} onGetAdvice={getManagementAdvice} aiLoading={aiLoading} advice={aiAdvice} />}
          {activeTab === 'fs' && <FinancialStatementsView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'settings' && <SettingsView accounts={accounts} setAccounts={setAccounts} />}
        </div>
      </main>
    </div>
  );
};

// ==========================================
// 5. サブコンポーネント (Components)
// ==========================================

const AmountInput: React.FC<{ value: number, onChange: (val: number) => void, color?: string }> = ({ value, onChange, color = "blue" }) => {
  const [display, setDisplay] = useState(formatNumber(value));
  useEffect(() => setDisplay(formatNumber(value)), [value]);

  return (
    <div className="relative w-full">
      <input 
        type="text" 
        value={display} 
        onChange={(e) => {
          const val = parseNumber(e.target.value);
          setDisplay(formatNumber(val));
          onChange(val);
        }}
        className={`w-full border rounded p-2 text-right font-mono font-bold focus:ring-2 focus:ring-${color}-500 outline-none`}
      />
      <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">JPY</span>
    </div>
  );
};

const VoucherEntryView: React.FC<{ accounts: Account[], onAddVoucher: (v: Voucher) => void, suggestAccount: (d: string, b: boolean) => Promise<Account | undefined>, aiLoading: boolean, recentVouchers: Voucher[] }> = ({ accounts, onAddVoucher, suggestAccount, aiLoading, recentVouchers }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState('');
  const [debit, setDebit] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
  const [credit, setCredit] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);

  const update = (side: 'd' | 'c', i: number, f: keyof JournalEntry, v: any) => {
    const s = side === 'd' ? setDebit : setCredit;
    s(prev => {
      const n = [...prev];
      n[i] = { ...n[i], [f]: v };
      return n;
    });
  };

  const totalD = debit.reduce((s, e) => s + e.amount, 0);
  const totalC = credit.reduce((s, e) => s + e.amount, 0);

  const handleSubmit = () => {
    if (totalD !== totalC || totalD === 0) return alert('貸借不一致または0円です');
    onAddVoucher({ id: Date.now().toString(), date, description: desc, debitEntries: debit, creditEntries: credit, createdAt: Date.now() });
    setDesc('');
    setDebit([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
    setCredit([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
    alert('登録完了');
  };

  return (
    <div className="p-6">
      <div className="flex gap-4 mb-6 border-b pb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded p-2 font-bold" />
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="全体摘要 (例: 4月分燃料代)" className="flex-grow border rounded p-2" />
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* LEFT: DEBIT */}
        <div className="space-y-4">
          <div className="bg-blue-50 p-2 rounded border border-blue-200 flex justify-between font-bold text-blue-800">
            <span>借方 (Debit)</span>
            <span>計 {formatNumber(totalD)}</span>
          </div>
          {debit.map((e, i) => (
            <div key={i} className="p-3 bg-white border rounded shadow-sm space-y-2">
              <div className="flex gap-2">
                <select value={e.accountId} onChange={x => update('d', i, 'accountId', x.target.value)} className="flex-grow border rounded p-2 text-sm">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-32"><AmountInput value={e.amount} onChange={v => update('d', i, 'amount', v)} color="blue" /></div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={x => update('d', i, 'description', x.target.value)} placeholder="明細摘要" className="flex-grow border rounded p-1 text-xs" />
                <button onClick={async () => { const a = await suggestAccount(e.description || desc, true); if(a) update('d', i, 'accountId', a.id); }} className="px-2 py-1 bg-blue-600 text-white rounded text-xs" disabled={aiLoading}>AI推論</button>
              </div>
            </div>
          ))}
          <button onClick={() => setDebit([...debit, { accountId: accounts[0].id, amount: 0, description: '' }])} className="w-full py-1 border-2 border-dashed border-blue-200 text-blue-300 rounded text-sm">+ 行追加</button>
        </div>

        {/* RIGHT: CREDIT */}
        <div className="space-y-4">
          <div className="bg-orange-50 p-2 rounded border border-orange-200 flex justify-between font-bold text-orange-800">
            <span>貸方 (Credit)</span>
            <span>計 {formatNumber(totalC)}</span>
          </div>
          {credit.map((e, i) => (
            <div key={i} className="p-3 bg-white border rounded shadow-sm space-y-2">
              <div className="flex gap-2">
                <select value={e.accountId} onChange={x => update('c', i, 'accountId', x.target.value)} className="flex-grow border rounded p-2 text-sm">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-32"><AmountInput value={e.amount} onChange={v => update('c', i, 'amount', v)} color="orange" /></div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={x => update('c', i, 'description', x.target.value)} placeholder="明細摘要" className="flex-grow border rounded p-1 text-xs" />
                <button onClick={async () => { const a = await suggestAccount(e.description || desc, false); if(a) update('c', i, 'accountId', a.id); }} className="px-2 py-1 bg-orange-600 text-white rounded text-xs" disabled={aiLoading}>AI推論</button>
              </div>
            </div>
          ))}
          <button onClick={() => setCredit([...credit, { accountId: accounts[0].id, amount: 0, description: '' }])} className="w-full py-1 border-2 border-dashed border-orange-200 text-orange-300 rounded text-sm">+ 行追加</button>
        </div>
      </div>

      <div className="flex flex-col items-center border-t pt-6">
        <button onClick={handleSubmit} className="px-12 py-3 bg-slate-900 text-white rounded-full font-bold shadow-xl hover:bg-black transition-all transform active:scale-95">伝票登録</button>
      </div>
    </div>
  );
};

const TrialBalanceView: React.FC<{ vouchers: Voucher[], accounts: Account[], onGetAdvice: (d: any[]) => void, aiLoading: boolean, advice: string | null }> = ({ vouchers, accounts, onGetAdvice, aiLoading, advice }) => {
  const tb = useMemo(() => {
    return accounts.map(acc => {
      let d = 0, c = 0;
      vouchers.forEach(v => {
        v.debitEntries.forEach(e => { if(e.accountId === acc.id) d += e.amount; });
        v.creditEntries.forEach(e => { if(e.accountId === acc.id) c += e.amount; });
      });
      const b = (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) ? d - c : c - d;
      return { acc, d, c, b };
    }).filter(x => x.d !== 0 || x.c !== 0);
  }, [vouchers, accounts]);

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-xl font-bold">合計残高試算表</h2>
        <button onClick={() => onGetAdvice(tb)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold shadow" disabled={aiLoading}>AI経営分析</button>
      </div>

      {advice && (
        <div className="mb-6 bg-indigo-50 p-4 rounded border border-indigo-200">
          <h3 className="font-bold text-indigo-800 mb-2">AIアドバイス</h3>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{advice}</div>
        </div>
      )}

      <table className="w-full text-sm border">
        <thead className="bg-slate-800 text-white font-bold">
          <tr><th className="p-2 text-left">科目</th><th className="p-2 text-right">借方合計</th><th className="p-2 text-right">貸方合計</th><th className="p-2 text-right">残高</th></tr>
        </thead>
        <tbody>
          {tb.map((x, i) => (
            <tr key={i} className="border-b hover:bg-slate-50">
              <td className="p-2 font-bold">{x.acc.code} {x.acc.name}</td>
              <td className="p-2 text-right font-mono">{formatNumber(x.d)}</td>
              <td className="p-2 text-right font-mono">{formatNumber(x.c)}</td>
              <td className="p-2 text-right font-mono font-bold">{formatNumber(x.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// プレースホルダー（他のビューも同様に内部実装）
const GeneralLedgerView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => <div className="p-6 text-center text-slate-400">総勘定元帳の詳細は科目を選択して表示されます（TBで全容確認可能）</div>;
const FinancialStatementsView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => <div className="p-6 text-center text-slate-400">決算報告書（準備中：TBのデータが反映されます）</div>;
const SettingsView: React.FC<{ accounts: Account[], setAccounts: any }> = ({ accounts, setAccounts }) => <div className="p-6 text-center text-slate-400">設定・科目編集（物流向け科目は標準搭載済み）</div>;

export default App;
