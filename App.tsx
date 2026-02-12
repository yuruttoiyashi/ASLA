
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Account, AccountType, Voucher, JournalEntry, TabType } from './types';

// --- Constants & Initial Data ---
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

const formatNumber = (num: number): string => {
  if (num === 0) return '0';
  return new Intl.NumberFormat('ja-JP').format(num);
};

const parseNumber = (val: string): number => {
  const sanitized = val.replace(/[^0-9]/g, '');
  return sanitized === '' ? 0 : parseInt(sanitized, 10);
};

// --- Main App Component ---

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
        contents: `以下の物流業の取引内容（摘要）から、借方または貸方の適切な勘定科目を推測してください。
        摘要: "${description}"
        区分: ${isDebit ? '借方' : '貸方'}
        候補科目リスト: ${accounts.map(a => a.name).join(', ')}
        JSON形式で返してください: {"accountName": "科目名"}`,
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
      const found = accounts.find(a => a.name === data.accountName);
      return found;
    } catch (e) {
      console.error("AI Account Suggestion Error:", e);
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
        contents: `以下の「合計残高試算表データ」を分析し、物流会社の経営改善に向けた具体的なアドバイスを生成してください。
        
        【分析データ】
        ${JSON.stringify(tbData)}
        
        【出力要件】
        1. 物流業界特有の視点（燃料費比率、車両修理費、人件費、売上原価など）を含めること。
        2. 経営リスクや改善のチャンスを3点、明確に提示すること。
        3. 専門用語を避けつつも、プロフェッショナルなトーンで回答すること。
        4. マークダウン形式（箇条書き）で回答すること。`,
        config: { 
          systemInstruction: "あなたは物流業界に特化した財務コンサルタント兼公認会計士です。財務諸表から経営の「急所」を見抜く達人です。" 
        }
      });
      setAiAdvice(response.text || "アドバイスを生成できませんでした。");
    } catch (e) {
      console.error("AI Management Advice Error:", e);
      setAiAdvice("AI分析中にエラーが発生しました。通信状況を確認してください。");
    } finally {
      setAiLoading(false);
    }
  };

  const addVoucher = (v: Voucher) => setVouchers(prev => [v, ...prev]);

  const reverseVoucher = (v: Voucher) => {
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
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold tracking-wider flex items-center gap-2">
              <i className="fas fa-truck-moving text-blue-400"></i>
              ASLA <span className="text-sm font-normal text-slate-400">Logistics Accounting</span>
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
                  className={`px-4 py-2 rounded-t-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                    activeTab === tab.id ? 'bg-white text-slate-900' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <i className={`fas ${tab.icon}`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6 max-w-7xl">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
          {activeTab === 'entry' && (
            <VoucherEntryView accounts={accounts} onAddVoucher={addVoucher} suggestAccount={suggestAccount} aiLoading={aiLoading} recentVouchers={vouchers} onReverse={reverseVoucher} />
          )}
          {activeTab === 'ledger' && <GeneralLedgerView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'tb' && <TrialBalanceView vouchers={vouchers} accounts={accounts} onGetAdvice={getManagementAdvice} aiLoading={aiLoading} advice={aiAdvice} />}
          {activeTab === 'fs' && <FinancialStatementsView vouchers={vouchers} accounts={accounts} />}
          {activeTab === 'settings' && <SettingsView accounts={accounts} setAccounts={setAccounts} />}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        &copy; 2025 ASLA Logistics Integrated Solutions. All Rights Reserved.
      </footer>
    </div>
  );
};

// --- Reusable Components ---

const AmountInput: React.FC<{ 
  value: number, 
  onChange: (val: number) => void, 
  className?: string, 
  focusColor?: string 
}> = ({ value, onChange, className, focusColor = "blue" }) => {
  const [displayValue, setDisplayValue] = useState(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parseNumber(rawValue);
    setDisplayValue(formatNumber(numericValue));
    onChange(numericValue);
  };

  return (
    <div className="relative">
      <input 
        type="text" 
        value={displayValue} 
        onChange={handleChange}
        className={`${className} w-full border rounded p-2 text-sm text-right font-mono font-medium focus:ring-2 focus:ring-${focusColor}-500 outline-none`}
        placeholder="0"
      />
      <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">JPY</span>
    </div>
  );
};

// --- Sub-Views ---

const VoucherEntryView: React.FC<{ 
  accounts: Account[], 
  onAddVoucher: (v: Voucher) => void, 
  suggestAccount: (desc: string, isDebit: boolean) => Promise<Account | undefined>,
  aiLoading: boolean,
  recentVouchers: Voucher[],
  onReverse: (v: Voucher) => void
}> = ({ accounts, onAddVoucher, suggestAccount, aiLoading, recentVouchers, onReverse }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [debitEntries, setDebitEntries] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
  const [creditEntries, setCreditEntries] = useState<JournalEntry[]>([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);

  const updateEntry = (isDebit: boolean, index: number, field: keyof JournalEntry, value: any) => {
    const setter = isDebit ? setDebitEntries : setCreditEntries;
    setter(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addEntry = (isDebit: boolean) => {
    const setter = isDebit ? setDebitEntries : setCreditEntries;
    setter(prev => [...prev, { accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
  };

  const removeEntry = (isDebit: boolean, index: number) => {
    const setter = isDebit ? setDebitEntries : setCreditEntries;
    setter(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSuggest = async (isDebit: boolean, index: number) => {
    const entry = isDebit ? debitEntries[index] : creditEntries[index];
    const account = await suggestAccount(entry.description || description, isDebit);
    if (account) {
      updateEntry(isDebit, index, 'accountId', account.id);
    }
  };

  const totalDebit = useMemo(() => debitEntries.reduce((sum, e) => sum + Number(e.amount), 0), [debitEntries]);
  const totalCredit = useMemo(() => creditEntries.reduce((sum, e) => sum + Number(e.amount), 0), [creditEntries]);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const handleSubmit = () => {
    if (!isBalanced) return alert('貸借金額が一致しません。');
    if (!description.trim()) return alert('摘要を入力してください。');
    
    onAddVoucher({
      id: `v-${Date.now()}`,
      date,
      debitEntries: debitEntries.map(e => ({ ...e })),
      creditEntries: creditEntries.map(e => ({ ...e })),
      description,
      createdAt: Date.now(),
    });

    setDescription('');
    setDebitEntries([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
    setCreditEntries([{ accountId: accounts[0]?.id || '', amount: 0, description: '' }]);
    alert('伝票を登録しました。');
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">伝票入力</h2>
          <p className="text-slate-500 text-sm">物流会計向けの左右分割入力レイアウトです。</p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 mb-1">取引日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex flex-col flex-grow min-w-[300px]">
            <label className="text-xs font-bold text-slate-500 mb-1">全体摘要</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="例：車両整備代金 3台分"
              className="border rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Left Side: Debit */}
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
            <h3 className="font-bold text-blue-700">借方 (Debit)</h3>
            <span className="text-sm font-mono font-bold text-blue-800">合計 {formatNumber(totalDebit)}</span>
          </div>
          {debitEntries.map((e, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative">
              {debitEntries.length > 1 && (
                <button onClick={() => removeEntry(true, i)} className="absolute -top-2 -right-2 bg-white text-red-400 border rounded-full w-6 h-6 flex items-center justify-center shadow hover:text-red-600 transition-colors">×</button>
              )}
              <div className="flex gap-2">
                <select value={e.accountId} onChange={ev => updateEntry(true, i, 'accountId', ev.target.value)} className="flex-grow border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-40">
                  <AmountInput value={e.amount} onChange={val => updateEntry(true, i, 'amount', val)} focusColor="blue" />
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={v => updateEntry(true, i, 'description', v.target.value)} placeholder="明細摘要" className="flex-grow border rounded p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={() => handleSuggest(true, i)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1" disabled={aiLoading}>
                  {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                  推論
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => addEntry(true)} className="w-full py-2 border-2 border-dashed border-blue-200 text-blue-400 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">+ 借方行追加</button>
        </div>

        {/* Right Side: Credit */}
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
            <h3 className="font-bold text-orange-700">貸方 (Credit)</h3>
            <span className="text-sm font-mono font-bold text-orange-800">合計 {formatNumber(totalCredit)}</span>
          </div>
          {creditEntries.map((e, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative">
              {creditEntries.length > 1 && (
                <button onClick={() => removeEntry(false, i)} className="absolute -top-2 -right-2 bg-white text-red-400 border rounded-full w-6 h-6 flex items-center justify-center shadow hover:text-red-600 transition-colors">×</button>
              )}
              <div className="flex gap-2">
                <select value={e.accountId} onChange={ev => updateEntry(false, i, 'accountId', ev.target.value)} className="flex-grow border rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
                </select>
                <div className="w-40">
                  <AmountInput value={e.amount} onChange={val => updateEntry(false, i, 'amount', val)} focusColor="orange" />
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={e.description} onChange={v => updateEntry(false, i, 'description', v.target.value)} placeholder="明細摘要" className="flex-grow border rounded p-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none" />
                <button onClick={() => handleSuggest(false, i)} className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1" disabled={aiLoading}>
                  {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                  推論
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => addEntry(false)} className="w-full py-2 border-2 border-dashed border-orange-200 text-orange-400 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium">+ 貸方行追加</button>
        </div>
      </div>

      <div className="flex flex-col items-center pt-8 border-t">
        <button onClick={handleSubmit} disabled={!isBalanced} className={`px-20 py-4 rounded-full font-bold text-xl shadow-xl transition-all ${isBalanced ? 'bg-slate-900 text-white hover:bg-black hover:scale-105' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          {isBalanced ? 'この仕訳を登録する' : '貸借不一致につき登録不可'}
        </button>
        {totalDebit !== totalCredit && (
          <p className="text-red-500 mt-4 font-bold">差額: {formatNumber(Math.abs(totalDebit - totalCredit))} JPY</p>
        )}
      </div>

      <div className="mt-16">
        <h3 className="text-lg font-bold text-slate-700 mb-4 border-l-4 border-slate-900 pl-3">直近の取引履歴（反対仕訳が可能）</h3>
        <div className="overflow-hidden border rounded-xl shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-left">日付</th>
                <th className="p-4 text-left">内容</th>
                <th className="p-4 text-right">金額</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentVouchers.slice(0, 5).map(v => {
                const total = v.debitEntries.reduce((s, e) => s + Number(e.amount), 0);
                return (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono">{v.date}</td>
                    <td className="p-4">{v.description}</td>
                    <td className="p-4 text-right font-bold font-mono">{formatNumber(total)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => { if(confirm('反対仕訳を作成しますか？')) onReverse(v); }} className="text-xs bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-all font-bold">
                        <i className="fas fa-undo-alt mr-1"></i> 反対仕訳作成
                      </button>
                    </td>
                  </tr>
                );
              })}
              {recentVouchers.length === 0 && (
                <tr><td colSpan={4} className="p-12 text-center text-slate-400">取引データがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GeneralLedgerView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  
  const ledgerLines = useMemo(() => {
    const lines: any[] = [];
    let balance = 0;
    const sortedVouchers = [...vouchers].sort((a, b) => a.date.localeCompare(b.date));

    sortedVouchers.forEach(v => {
      v.debitEntries.forEach(e => {
        if (e.accountId === selectedAccountId) {
          const account = accounts.find(a => a.id === selectedAccountId);
          const isAssetOrExpense = account?.type === AccountType.ASSET || account?.type === AccountType.EXPENSE;
          balance += isAssetOrExpense ? e.amount : -e.amount;
          lines.push({ date: v.date, desc: e.description || v.description, debit: e.amount, credit: 0, balance });
        }
      });
      v.creditEntries.forEach(e => {
        if (e.accountId === selectedAccountId) {
          const account = accounts.find(a => a.id === selectedAccountId);
          const isAssetOrExpense = account?.type === AccountType.ASSET || account?.type === AccountType.EXPENSE;
          balance += isAssetOrExpense ? -e.amount : e.amount;
          lines.push({ date: v.date, desc: e.description || v.description, debit: 0, credit: e.amount, balance });
        }
      });
    });
    return lines;
  }, [vouchers, selectedAccountId, accounts]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">総勘定元帳</h2>
        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="border-2 border-slate-200 rounded-lg px-6 py-2 font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.code}: {a.name}</option>)}
        </select>
      </div>

      <div className="overflow-hidden border rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-4 text-left w-32">日付</th>
              <th className="p-4 text-left">摘要</th>
              <th className="p-4 text-right w-32">借方</th>
              <th className="p-4 text-right w-32">貸方</th>
              <th className="p-4 text-right w-40">残高</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {ledgerLines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-sans text-slate-500">{line.date}</td>
                <td className="p-4 font-sans">{line.desc}</td>
                <td className="p-4 text-right text-blue-600 font-bold">{line.debit ? formatNumber(line.debit) : '-'}</td>
                <td className="p-4 text-right text-orange-600 font-bold">{line.credit ? formatNumber(line.credit) : '-'}</td>
                <td className={`p-4 text-right font-bold ${line.balance < 0 ? 'text-red-500' : 'text-slate-800'}`}>{formatNumber(line.balance)}</td>
              </tr>
            ))}
            {ledgerLines.length === 0 && (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic">データがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TrialBalanceView: React.FC<{ 
  vouchers: Voucher[], 
  accounts: Account[], 
  onGetAdvice: (data: any[]) => void, 
  aiLoading: boolean,
  advice: string | null
}> = ({ vouchers, accounts, onGetAdvice, aiLoading, advice }) => {
  const tbData = useMemo(() => {
    return accounts.map(account => {
      let debitTotal = 0;
      let creditTotal = 0;
      vouchers.forEach(v => {
        v.debitEntries.forEach(e => { if (e.accountId === account.id) debitTotal += Number(e.amount); });
        v.creditEntries.forEach(e => { if (e.accountId === account.id) creditTotal += Number(e.amount); });
      });
      const isAssetOrExpense = account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;
      const balance = isAssetOrExpense ? debitTotal - creditTotal : creditTotal - debitTotal;
      return { code: account.code, name: account.name, type: account.type, debitTotal, creditTotal, balance };
    }).filter(d => d.debitTotal !== 0 || d.creditTotal !== 0);
  }, [vouchers, accounts]);

  const totals = useMemo(() => {
    return tbData.reduce((acc, curr) => ({
      debit: acc.debit + curr.debitTotal,
      credit: acc.credit + curr.creditTotal,
    }), { debit: 0, credit: 0 });
  }, [tbData]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">合計残高試算表</h2>
          <p className="text-sm text-slate-500">財務状況の全体像を把握します。</p>
        </div>
        <button 
          onClick={() => onGetAdvice(tbData)}
          disabled={aiLoading || tbData.length === 0}
          className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-xl font-bold shadow-lg hover:shadow-blue-200 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
        >
          {aiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-microchip"></i>}
          AIで経営分析を実行
        </button>
      </div>

      {/* AI Advice Display Area */}
      {(aiLoading || advice) && (
        <div className="mb-10 bg-indigo-50 border border-indigo-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="flex items-center gap-2 text-indigo-900 font-bold mb-3">
            <i className="fas fa-robot"></i> AI経営診断結果
          </h3>
          {aiLoading ? (
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.15s]"></div>
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.3s]"></div>
              <span className="text-sm font-medium">データを読み解いています... しばらくお待ちください。</span>
            </div>
          ) : (
            <div className="prose prose-indigo max-w-none text-slate-700 text-sm leading-relaxed">
              {advice?.split('\n').map((line, i) => (
                <p key={i} className="mb-2 last:mb-0">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden border rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-4 text-left">コード</th>
              <th className="p-4 text-left">勘定科目</th>
              <th className="p-4 text-right">借方合計</th>
              <th className="p-4 text-right">貸方合計</th>
              <th className="p-4 text-right">差引残高</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {tbData.map((d, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-sans text-slate-500">{d.code}</td>
                <td className="p-4 font-sans font-bold text-slate-800">{d.name}</td>
                <td className="p-4 text-right text-blue-700">{formatNumber(d.debitTotal)}</td>
                <td className="p-4 text-right text-orange-700">{formatNumber(d.creditTotal)}</td>
                <td className="p-4 text-right font-bold text-slate-900 bg-slate-50">{formatNumber(d.balance)}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold border-t-4 border-slate-300 text-lg">
              <td colSpan={2} className="p-4 text-center font-sans">合計</td>
              <td className="p-4 text-right text-blue-900 underline decoration-double">{formatNumber(totals.debit)}</td>
              <td className="p-4 text-right text-orange-900 underline decoration-double">{formatNumber(totals.credit)}</td>
              <td className="p-4 text-right"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FinancialStatementsView: React.FC<{ vouchers: Voucher[], accounts: Account[] }> = ({ vouchers, accounts }) => {
  const statement = useMemo(() => {
    const plItems: any[] = [];
    const bsItems: any[] = [];
    let netIncome = 0;

    accounts.forEach(account => {
      let debitTotal = 0;
      let creditTotal = 0;
      vouchers.forEach(v => {
        v.debitEntries.forEach(e => { if (e.accountId === account.id) debitTotal += Number(e.amount); });
        v.creditEntries.forEach(e => { if (e.accountId === account.id) creditTotal += Number(e.amount); });
      });
      const isAssetOrExpense = account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;
      const amount = isAssetOrExpense ? debitTotal - creditTotal : creditTotal - debitTotal;
      if (amount === 0) return;
      if (account.type === AccountType.REVENUE || account.type === AccountType.EXPENSE) {
        plItems.push({ name: account.name, amount, type: account.type });
        netIncome += account.type === AccountType.REVENUE ? amount : -amount;
      } else {
        bsItems.push({ name: account.name, amount, type: account.type });
      }
    });
    return { plItems, bsItems, netIncome };
  }, [vouchers, accounts]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-10 border-b pb-4">決算報告書</h2>
      
      <div className="grid grid-cols-2 gap-12">
        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-2">
            <i className="fas fa-file-invoice-dollar"></i> 損益計算書 (P/L)
          </h3>
          <div className="space-y-3">
            {statement.plItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white font-mono">
                <span className={item.type === AccountType.REVENUE ? 'font-bold text-indigo-600' : 'text-slate-600'}>{item.name}</span>
                <span className="font-bold">{formatNumber(item.amount)}</span>
              </div>
            ))}
            <div className="mt-10 p-6 bg-indigo-900 text-white rounded-2xl flex justify-between items-center shadow-2xl">
              <span className="text-lg font-bold">当期純利益</span>
              <span className="font-mono text-3xl font-bold">{formatNumber(statement.netIncome)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-green-900 mb-6 flex items-center gap-2">
            <i className="fas fa-balance-scale"></i> 貸借対照表 (B/S)
          </h3>
          <div className="space-y-8">
             <section>
               <h4 className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full w-fit mb-4">資産の部</h4>
               {statement.bsItems.filter(i => i.type === AccountType.ASSET).map((item, i) => (
                 <div key={i} className="flex justify-between items-center py-2 border-b border-dotted font-mono">
                   <span>{item.name}</span>
                   <span className="font-bold">{formatNumber(item.amount)}</span>
                 </div>
               ))}
             </section>
             <section>
               <h4 className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full w-fit mb-4">負債・純資産の部</h4>
               <div className="space-y-1">
                 {statement.bsItems.filter(i => i.type !== AccountType.ASSET).map((item, i) => (
                   <div key={i} className="flex justify-between items-center py-2 border-b border-dotted font-mono">
                     <span>{item.name}</span>
                     <span className="font-bold">{formatNumber(item.amount)}</span>
                   </div>
                 ))}
                 <div className="flex justify-between items-center py-3 px-2 mt-4 bg-slate-50 font-bold border-l-4 border-indigo-500 font-mono">
                   <span className="text-indigo-800">当期純利益</span>
                   <span>{formatNumber(statement.netIncome)}</span>
                 </div>
               </div>
             </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView: React.FC<{ accounts: Account[], setAccounts: React.Dispatch<React.SetStateAction<Account[]>> }> = ({ accounts, setAccounts }) => {
  const [newAccount, setNewAccount] = useState({ code: '', name: '', type: AccountType.EXPENSE });

  const addAccount = () => {
    if (!newAccount.code || !newAccount.name) return alert('入力が不足しています。');
    if (accounts.some(a => a.code === newAccount.code)) return alert('コードが重複しています。');
    setAccounts(prev => [...prev, { ...newAccount, id: `acc-${Date.now()}` }].sort((a, b) => a.code.localeCompare(b.code)));
    setNewAccount({ code: '', name: '', type: AccountType.EXPENSE });
  };

  const removeAccount = (id: string) => {
    if (!confirm('削除しますか？')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
        <i className="fas fa-cog text-slate-400"></i> 設定・勘定科目マスター
      </h2>
      
      <div className="bg-slate-900 p-8 rounded-3xl text-white mb-12 shadow-2xl">
        <h3 className="text-lg font-bold mb-6 text-blue-400 flex items-center gap-2">
          <i className="fas fa-plus-circle"></i> 物流向け追加科目 (燃料・高速代・保守等)
        </h3>
        <div className="grid grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">コード</label>
            <input type="text" value={newAccount.code} onChange={e => setNewAccount({...newAccount, code: e.target.value})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="5108" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">科目名</label>
            <input type="text" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="車両保険料" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">区分</label>
            <select value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value as AccountType})} className="w-full bg-slate-800 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={addAccount} className="bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg active:scale-95">マスター登録</button>
        </div>
      </div>

      <div className="overflow-hidden border rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 text-left">コード</th>
              <th className="p-4 text-left">名称</th>
              <th className="p-4 text-left">属性</th>
              <th className="p-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-4 font-mono text-slate-500">{a.code}</td>
                <td className="p-4 font-bold">{a.name}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    a.type === AccountType.ASSET ? 'bg-green-100 text-green-700' :
                    a.type === AccountType.LIABILITY ? 'bg-amber-100 text-amber-700' :
                    a.type === AccountType.REVENUE ? 'bg-indigo-100 text-indigo-700' :
                    a.type === AccountType.EXPENSE ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                  }`}>{a.type}</span>
                </td>
                <td className="p-4 text-center">
                  {!a.isStandard && (
                    <button onClick={() => removeAccount(a.id)} className="text-red-300 hover:text-red-600 transition-colors"><i className="fas fa-trash-alt"></i></button>
                  )}
                  {a.isStandard && <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Fixed</span>}
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
