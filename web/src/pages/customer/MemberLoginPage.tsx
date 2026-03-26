import { useState } from 'react';
import { Loader2, Phone, Lock, Star, User, Info, LogOut } from 'lucide-react';

const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

interface MemberData {
  name: string;
  points: number;
  info: string;
}

async function callCustomerApi(action: string, payload: Record<string, any>) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ apiKey: API_KEY, action, payload }),
  });
  return res.json();
}

export default function MemberLoginPage() {
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [member, setMember] = useState<MemberData | null>(() => {
    const saved = localStorage.getItem('os_member');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !birth) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await callCustomerApi('memberLogin', { phone, birth });
      if (res.success) {
        setMember(res.data);
        localStorage.setItem('os_member', JSON.stringify(res.data));
        localStorage.setItem('os_member_time', Date.now().toString());
      } else {
        setError(res.message || '登入失敗');
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('os_member');
    localStorage.removeItem('os_member_time');
    setMember(null);
    setPhone('');
    setBirth('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-start justify-center pt-8 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo-full.png" alt="OneSoul" className="h-20 mx-auto mb-2" />
        </div>

        {member ? (
          /* ── 會員資訊卡 ── */
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl shadow-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <img src="/logo-only-monster.png" alt="" className="w-40 h-40" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">會員資料</p>
                  <h2 className="text-3xl font-black flex items-center gap-2">
                    <User className="w-7 h-7" />
                    {member.name}
                  </h2>
                </div>
                <button onClick={handleLogout} className="text-orange-200 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white/15 backdrop-blur rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 text-yellow-300" />
                  <div>
                    <p className="text-orange-200 text-xs font-bold uppercase tracking-widest">目前點數</p>
                    <p className="text-4xl font-black tracking-tight">{member.points.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {member.info && (
                <div className="bg-white/10 rounded-xl p-3 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-orange-200 flex-shrink-0" />
                  <p className="text-sm text-orange-100">{member.info}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── 登入表單 ── */
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-orange-100">
            <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">會員登入</h2>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  玩家電話 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0912345678"
                    pattern="[0-9]{9,10}"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all text-lg font-bold tracking-wider text-slate-800 placeholder:text-slate-300"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 ml-1">註冊時留下的電話</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  玩家生日 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={birth}
                    onChange={e => setBirth(e.target.value)}
                    placeholder="19990401"
                    pattern="[0-9]{8}"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all text-lg font-bold tracking-wider text-slate-800 placeholder:text-slate-300"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 ml-1">格式：19990401（1999年4月1號）</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-lg rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isLoading ? '登入中...' : '登入'}
              </button>
            </form>
          </div>
        )}

        {/* 注意事項 */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h4 className="font-bold text-amber-800 mb-2">📋 注意事項</h4>
          <p className="text-sm text-amber-700 leading-relaxed">
            當天遊玩點數，需等待隔天查詢，店員努力輸入系統中。如有急需或點數與想像的不同，請勿慌張，可以私訊{' '}
            <a href="https://www.instagram.com/onesoul.zb" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-600 hover:underline">
              IG: onesoul.zb
            </a>
            ，小編會盡快確認。
          </p>
        </div>
      </div>
    </div>
  );
}
