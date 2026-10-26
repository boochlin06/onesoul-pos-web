import React, { useEffect, useState } from 'react';
import { scheduleApi } from '../api/client';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  X,
  Store
} from 'lucide-react';

export const ScheduleView: React.FC = () => {
  const [storeId, setStoreId] = useState<'chupei' | 'jinshan'>('chupei');
  const [yearMonth, setYearMonth] = useState('2026-10');
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 編輯單日排班 Modal
  const [editDay, setEditDay] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [shiftType, setShiftType] = useState('FULL');
  const [isClosed, setIsClosed] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 補打卡 Modal
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [clockInStaff, setClockInStaff] = useState('');
  const [clockInTime, setClockInTime] = useState('');
  const [clockInLoading, setClockInLoading] = useState(false);
  const [clockInResult, setClockInResult] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [storeId, yearMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schRes, attRes] = await Promise.all([
        scheduleApi.getMonth(storeId, yearMonth),
        scheduleApi.listAttendance(storeId),
      ]);

      if (schRes.success) setScheduleData(schRes.data);
      if (attRes.success) setAttendanceList(attRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDay) return;

    setSaving(true);
    try {
      await scheduleApi.batchUpdate(storeId, [
        {
          date: editDay,
          staffName,
          shiftType,
          isClosed,
          note,
        },
      ]);
      setEditDay(null);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClockInLoading(true);
    setClockInResult(null);
    try {
      const res = await scheduleApi.clockIn(storeId, clockInStaff, clockInTime || undefined);
      if (res.success) {
        setClockInResult(res.data);
        loadData();
      }
    } catch (err: any) {
      setClockInResult({ error: err.message || '打卡失敗' });
    } finally {
      setClockInLoading(false);
    }
  };

  // 產生當月 1~31 天的排班矩陣
  const daysInMonth = Array.from({ length: 31 }, (_, i) => {
    const dayNum = String(i + 1).padStart(2, '0');
    const dateStr = `${yearMonth}-${dayNum}`;
    const entry = scheduleData?.schedules?.find((s: any) => s.date === dateStr);
    return {
      date: dateStr,
      day: i + 1,
      entry,
    };
  });

  return (
    <div className="space-y-6">
      {/* 頂部切換與工具列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">班表排班與員工考勤打卡</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            完全取代舊版 Google Sheets 排班表。自動比對應到時間與遲到寬限 (15分鐘)，遲到自動推播 LINE Outbox 任務。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setStoreId('chupei')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                storeId === 'chupei' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              竹北旗艦店
            </button>
            <button
              onClick={() => setStoreId('jinshan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                storeId === 'jinshan' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              金山概念店
            </button>
          </div>

          <button
            onClick={() => {
              setShowClockInModal(true);
              setClockInResult(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <UserCheck className="w-4 h-4" />
            現場補打卡 / 考勤登記
          </button>
        </div>
      </div>

      {/* 月曆排班檢視 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>{yearMonth} 月值班排程</span>
            <span className="text-xs font-normal text-slate-400">
              ({storeId === 'chupei' ? '竹北店 • 營業時間 14:00' : '金山店 • 營業時間 16:00'})
            </span>
          </h2>
          <div className="text-xs text-slate-400">點選任一日期可排定值班店員或公休日</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {daysInMonth.map(({ date, day, entry }) => (
            <div
              key={date}
              onClick={() => {
                setEditDay(date);
                setStaffName(entry?.staffName || '');
                setShiftType(entry?.shiftType || 'FULL');
                setIsClosed(entry?.isClosed || false);
                setNote(entry?.note || '');
              }}
              className={`p-3 rounded-xl border cursor-pointer transition hover:scale-102 flex flex-col justify-between min-h-[90px] ${
                entry?.isClosed
                  ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                  : entry?.staffName
                  ? 'bg-slate-900/80 border-indigo-500/30 text-slate-200'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs">{day} 日</span>
                {entry?.isClosed && (
                  <span className="text-[10px] px-1 bg-rose-500/20 text-rose-300 rounded">休</span>
                )}
              </div>

              <div className="mt-2">
                {entry?.isClosed ? (
                  <div className="text-xs font-semibold text-rose-400">門市店休</div>
                ) : entry?.staffName ? (
                  <div>
                    <div className="text-xs font-bold text-indigo-300 truncate">{entry.staffName}</div>
                    <div className="text-[10px] text-slate-400">
                      {entry.shiftType === 'FULL' ? '全日班' : entry.shiftType === 'EARLY' ? '早班' : '晚班'}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-600">+ 點擊排班</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 考勤打卡紀錄表格 */}
      <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">考勤打卡流水與遲到監控 (門市 15 分鐘寬限)</h3>
          </div>
          <span className="text-xs text-slate-400">共 {attendanceList.length} 筆打卡記錄</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">員工姓名</th>
                <th className="py-3 px-4">門市</th>
                <th className="py-3 px-4">打卡日期</th>
                <th className="py-3 px-4">實際打卡時間</th>
                <th className="py-3 px-4">考勤狀態</th>
                <th className="py-3 px-4 text-right">遲到分鐘數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {attendanceList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    尚無考勤打卡紀錄
                  </td>
                </tr>
              ) : (
                attendanceList.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-750/50 transition">
                    <td className="py-3 px-4 font-semibold text-white">{att.staffName}</td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {att.storeId === 'chupei' ? '竹北店' : '金山店'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">{att.date}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-200">
                      {new Date(att.clockInTime).toLocaleTimeString('zh-TW')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        att.status === 'LATE'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {att.status === 'LATE' ? '遲到' : '正常出勤'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {att.lateMinutes > 0 ? (
                        <span className="text-rose-400">+{att.lateMinutes} 分鐘</span>
                      ) : (
                        <span className="text-emerald-400">0 分</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 排班編輯 Modal */}
      {editDay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setEditDay(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">排定 {editDay} 值班人員</h3>
            </div>

            <form onSubmit={handleSaveDay} className="space-y-4">
              <div className="flex items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-750">
                <input
                  type="checkbox"
                  id="isClosedCheck"
                  checked={isClosed}
                  onChange={(e) => setIsClosed(e.target.checked)}
                  className="rounded border-slate-750 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="isClosedCheck" className="text-xs text-slate-200 font-medium cursor-pointer">
                  本日設定為門市公休日
                </label>
              </div>

              {!isClosed && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">值班人員姓名</label>
                    <input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">班別</label>
                    <select
                      value={shiftType}
                      onChange={(e) => setShiftType(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                    >
                      <option value="FULL">全日班</option>
                      <option value="EARLY">早班</option>
                      <option value="LATE">晚班</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">備註說明</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如: 支援金山店、盤點日..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDay(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow disabled:opacity-50"
                >
                  {saving ? '儲存中...' : '儲存排班'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 補打卡 Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setShowClockInModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">現場補打卡 / 考勤登錄</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              系統將自動計算打卡時間是否超出營業時間 15 分鐘寬限期。若遲到將自動觸發 LINE Outbox 任務通知群組。
            </p>

            {clockInResult && (
              <div className={`p-3 rounded-xl text-xs mb-3 ${clockInResult.error ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {clockInResult.error
                  ? clockInResult.error
                  : `打卡成功！狀態：${clockInResult.status === 'LATE' ? `遲到 (超出 ${clockInResult.lateMinutes} 分鐘)` : '正常準時到班'}`}
              </div>
            )}

            <form onSubmit={handleClockInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">打卡員工</label>
                <input
                  type="text"
                  value={clockInStaff}
                  onChange={(e) => setClockInStaff(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  打卡時間 (預設當前時間，亦可手動補登 ISO 時間)
                </label>
                <input
                  type="text"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                  placeholder="留空為當下時間，或例: 2026-10-09T14:35:00Z"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClockInModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-xl"
                >
                  關閉
                </button>
                <button
                  type="submit"
                  disabled={clockInLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow disabled:opacity-50"
                >
                  {clockInLoading ? '打卡中...' : '確認送出打卡'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
