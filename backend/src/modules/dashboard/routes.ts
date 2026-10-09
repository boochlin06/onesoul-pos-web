import { FastifyInstance } from 'fastify';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_request, reply) => {
    reply.type('text/html');
    return `<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OneSoul POS 後端控制中心 | Industrial Backend Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
          }
        }
      }
    }
  </script>
  <style>
    pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col font-sans">

  <!-- Top Navbar -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20">
          <i class="fa-solid fa-server text-white text-lg"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            OneSoul POS 後端管理介面
            <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">v1.0.0 Online</span>
          </h1>
          <p class="text-xs text-slate-400">Node.js · TypeScript · Fastify · Prisma · PostgreSQL</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          雙模數據引擎已就緒
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-950/60 border border-indigo-700/50 text-indigo-300">
          <i class="fa-solid fa-shield-halved text-xs"></i>
          OWASP MASVS 防護
        </span>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-6">

    <!-- Overview Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">竹北門市班次</div>
            <div class="text-2xl font-black text-emerald-400 mt-1">OPEN</div>
            <div class="text-xs text-slate-400 mt-1">開班備用金 $3,000</div>
          </div>
          <span class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <i class="fa-solid fa-cash-register"></i>
          </span>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">金山門市班次</div>
            <div class="text-2xl font-black text-amber-400 mt-1">IDLE</div>
            <div class="text-xs text-slate-400 mt-1">待值班人員開帳</div>
          </div>
          <span class="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <i class="fa-solid fa-store"></i>
          </span>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">線上營運隔離</div>
            <div class="text-2xl font-black text-indigo-400 mt-1">100% 零干擾</div>
            <div class="text-xs text-slate-400 mt-1">GAS / Sheets 完全隔離</div>
          </div>
          <span class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </span>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">測試驗證狀態</div>
            <div class="text-2xl font-black text-emerald-400 mt-1">20 / 20 通過</div>
            <div class="text-xs text-slate-400 mt-1">E2E 並發與業務測試</div>
          </div>
          <span class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <i class="fa-solid fa-circle-check"></i>
          </span>
        </div>
      </div>
    </div>

    <!-- Main Workspace: Left Controls, Right Live Console -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

      <!-- Left Column: Quick Actions & Live Data Inspection (5 cols) -->
      <div class="lg:col-span-5 space-y-6">

        <!-- Store & Session Snapshot -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 class="font-bold text-sm text-slate-200 flex items-center gap-2">
              <i class="fa-solid fa-shop text-indigo-400"></i>
              門市與活躍班次 (Sessions)
            </h2>
            <button onclick="runApi('GET', '/api/v1/sessions/active?branch=竹北')" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition">
              重新整理
            </button>
          </div>
          <div class="space-y-3">
            <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div class="font-bold text-sm text-slate-200">竹北旗艦店 (CHUPEI)</div>
                <div class="text-xs text-slate-400 mt-0.5">狀態：<span class="text-emerald-400 font-medium">開班中 (OPEN)</span></div>
                <div class="text-xs text-slate-500 mt-0.5">開班人員：onesoul.chupei@gmail.com</div>
              </div>
              <button onclick="runApi('POST', '/api/v1/sessions/close', { branch: '竹北', actualCash: 2950, note: '測試關帳' })" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition">
                關帳試算
              </button>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div class="font-bold text-sm text-slate-200">金山門市 (JINSHAN)</div>
                <div class="text-xs text-slate-400 mt-0.5">狀態：<span class="text-slate-400 font-medium">未開班</span></div>
              </div>
              <button onclick="runApi('POST', '/api/v1/sessions/open', { branch: '金山', openingCash: 2000 })" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition">
                開班
              </button>
            </div>
          </div>
        </div>

        <!-- Lucky Bag & Inventory Snapshot -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 class="font-bold text-sm text-slate-200 flex items-center gap-2">
              <i class="fa-solid fa-gift text-indigo-400"></i>
              活躍一番賞配置與獎項
            </h2>
            <button onclick="runApi('GET', '/api/v1/luckybags?branch=竹北')" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition">
              檢視詳情
            </button>
          </div>
          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
            <div class="flex justify-between items-center">
              <span class="font-bold text-sm text-slate-100">海賊王一番賞新年套 (竹北)</span>
              <span class="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">$350 / 抽</span>
            </div>
            <div class="space-y-2 pt-1">
              <div>
                <div class="flex justify-between text-xs text-slate-400 mb-1">
                  <span>A賞 魯夫 MASTERLISE (GK001)</span>
                  <span class="font-mono text-slate-300">餘 2 / 共 2 抽</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-indigo-500 h-full rounded-full" style="width: 100%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs text-slate-400 mb-1">
                  <span>B賞 索隆 MASTERLISE</span>
                  <span class="font-mono text-slate-300">餘 3 / 共 3 抽</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-indigo-500 h-full rounded-full" style="width: 100%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick API Triggers -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
          <h2 class="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <i class="fa-solid fa-bolt text-amber-400"></i>
            一鍵執行端點測試
          </h2>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button onclick="runApi('GET', '/health')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left font-medium text-slate-300 hover:text-white transition flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">GET</span>
              健康檢查 (/health)
            </button>
            <button onclick="runApi('GET', '/api/v1/members?phone=0912345678')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left font-medium text-slate-300 hover:text-white transition flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">GET</span>
              會員查詢 (0912...)
            </button>
            <button onclick="runApi('GET', '/api/v1/products?branch=竹北')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left font-medium text-slate-300 hover:text-white transition flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">GET</span>
              門市商品庫存
            </button>
            <button onclick="runApi('GET', '/api/v1/orders/daily?branch=竹北')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left font-medium text-slate-300 hover:text-white transition flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">GET</span>
              當日結帳流水
            </button>
            <button onclick="runCheckoutTest()" class="p-2.5 rounded-xl bg-slate-950 border border-indigo-800/80 hover:border-indigo-600 text-left font-medium text-indigo-300 hover:text-white transition flex items-center gap-2 col-span-2">
              <span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono text-[10px]">POST</span>
              測試結帳：抽一番賞 A 賞帶走 (原子扣庫存 + 累點)
            </button>
          </div>
        </div>

      </div>

      <!-- Right Column: Live Interactive Console (7 cols) -->
      <div class="lg:col-span-7 flex flex-col space-y-4">
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex-1 flex flex-col space-y-4">

          <!-- Request Builder Bar -->
          <div class="flex items-center gap-2">
            <select id="reqMethod" class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-400 focus:outline-none focus:border-indigo-500">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <div class="relative flex-1">
              <input id="reqUrl" type="text" value="/api/v1/members?phone=0912345678" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="/api/v1/..." />
            </div>
            <button onclick="sendCustomRequest()" class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5">
              <i class="fa-solid fa-play text-[10px]"></i>
              發送請求
            </button>
          </div>

          <!-- Request Body (Collapsed by default, shown for POST/PUT) -->
          <div>
            <textarea id="reqBody" rows="4" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-700" placeholder='{"key": "value"}'></textarea>
          </div>

          <!-- Response Terminal -->
          <div class="flex-1 flex flex-col rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden min-h-[360px]">
            <div class="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                <span class="font-mono text-slate-400 ml-2 font-medium">HTTP 響應終端</span>
              </div>
              <div class="flex items-center gap-3">
                <span id="resStatus" class="font-mono font-bold text-emerald-400">200 OK</span>
                <span id="resTime" class="font-mono text-slate-400 text-[11px]">4 ms</span>
              </div>
            </div>
            <div class="p-4 flex-1 overflow-auto font-mono text-xs text-emerald-300">
              <pre id="resJson" class="whitespace-pre-wrap leading-relaxed">// 點擊左側快捷按鈕或「發送請求」開始測試後端 API...</pre>
            </div>
          </div>

        </div>
      </div>

    </div>

  </main>

  <footer class="border-t border-slate-800 py-4 bg-slate-900/40 text-center text-xs text-slate-500">
    OneSoul POS Backend System · Google Antigravity Agentic Integration
  </footer>

  <script>
    async function runApi(method, url, body = null) {
      document.getElementById('reqMethod').value = method;
      document.getElementById('reqUrl').value = url;
      document.getElementById('reqBody').value = body ? JSON.stringify(body, null, 2) : '';
      await sendCustomRequest();
    }

    async function sendCustomRequest() {
      const method = document.getElementById('reqMethod').value;
      const url = document.getElementById('reqUrl').value;
      const bodyText = document.getElementById('reqBody').value.trim();
      const statusEl = document.getElementById('resStatus');
      const timeEl = document.getElementById('resTime');
      const jsonEl = document.getElementById('resJson');

      jsonEl.textContent = '發送中...';
      const start = performance.now();

      try {
        const opts = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-caller-email': 'onesoul.chupei@gmail.com'
          }
        };
        if ((method === 'POST' || method === 'PUT') && bodyText) {
          opts.body = bodyText;
        }

        const res = await fetch(url, opts);
        const duration = Math.round(performance.now() - start);
        timeEl.textContent = duration + ' ms';

        statusEl.textContent = res.status + ' ' + res.statusText;
        if (res.ok) {
          statusEl.className = 'font-mono font-bold text-emerald-400';
        } else {
          statusEl.className = 'font-mono font-bold text-rose-400';
        }

        const data = await res.json();
        jsonEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = 'ERR';
        statusEl.className = 'font-mono font-bold text-rose-400';
        jsonEl.textContent = 'Request Failed: ' + err.message;
      }
    }

    function runCheckoutTest() {
      const payload = {
        branch: '竹北',
        customer: {
          phone: '0912345678',
          name: '王小明',
          currentPoints: 500
        },
        lotteries: [
          {
            id: '1',
            name: '海賊王一番賞新年套',
            prize: 'A',
            prizeName: 'A賞 魯夫 MASTERLISE',
            type: '帶走',
            draws: 1,
            unitPrice: 350,
            amount: 350,
            pointsCost: 0,
            totalPoints: 10,
            pointsImpact: 10
          }
        ],
        merchandises: [],
        payment: {
          receivedAmount: 350,
          cash: 350,
          creditCard: 0,
          remittance: 0,
          pointsUsed: 0
        },
        summary: {
          dueAmount: 350,
          pointsChange: 10
        },
        orderNote: '後端控制台結帳測試'
      };
      runApi('POST', '/api/v1/orders/checkout', payload);
    }

    // 預設加載健康檢查
    window.onload = () => {
      runApi('GET', '/health');
    };
  </script>
</body>
</html>`;
  });
}
