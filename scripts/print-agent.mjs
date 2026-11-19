#!/usr/bin/env node
/**
 * OneSoul Localhost Print Agent Daemon
 *
 * 門市桌機本機出單守護行程 (Node.js HTTP Server)
 * 監聽 127.0.0.1:18181，全面支援 Chrome Private Network Access (PNA/LNA) 標頭
 * 接收 POS 前端收銀出單請求，並將收據格式化輸出至熱感應出單機 / 標準日誌。
 */

import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 18181;
export const DEFAULT_HOST = '127.0.0.1';

/**
 * 取得允許之 CORS Origin
 */
export function getCorsOrigin(req) {
  const reqOrigin = req.headers['origin'];
  if (!reqOrigin) return '*';
  // 支援本機開發與 OneSoul 正式生產網域
  if (
    reqOrigin.startsWith('http://localhost:') ||
    reqOrigin.startsWith('http://127.0.0.1:') ||
    reqOrigin.endsWith('.onesoul.tw') ||
    reqOrigin === 'https://pos.onesoul.tw'
  ) {
    return reqOrigin;
  }
  return '*';
}

/**
 * 注入 Chrome PNA / LNA 與 CORS 標頭
 */
export function setPnaHeaders(req, res) {
  const origin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Print-Token');
  if (origin !== '*') {
    res.setHeader('Vary', 'Origin');
  }
}

/**
 * 格式化收據至終端機輸出 (模擬 ESC/POS 熱感應出單效果)
 */
export function printReceiptToConsole(receipt) {
  const divider = '─'.repeat(42);
  const doubleDivider = '═'.repeat(42);
  const now = receipt.printedAt || new Date().toISOString();

  console.log(`\n${doubleDivider}`);
  console.log(`         ONESOUL 萬魂玩具模型專賣店        `);
  console.log(`            收據列印 (RECEIPT)            `);
  console.log(doubleDivider);
  console.log(`門市代碼: ${receipt.storeId || 'chupei'}`);
  console.log(`訂單編號: ${receipt.orderNumber || receipt.orderId || 'N/A'}`);
  console.log(`交易時間: ${now}`);
  console.log(divider);

  if (Array.isArray(receipt.items) && receipt.items.length > 0) {
    console.log(`品項明細:`);
    for (const item of receipt.items) {
      if (item.type === 'lottery') {
        console.log(`  [一番賞] ${item.name || ''} (${item.prize || ''}賞: ${item.prizeName || ''}) x${item.draws || 1}  $${item.amount || 0}`);
      } else {
        console.log(`  [直購品] ${item.name || '商品'} x${item.quantity || 1}  $${item.amount || 0}`);
      }
    }
  } else {
    console.log(`品項明細: 無`);
  }

  console.log(divider);
  if (receipt.summary) {
    console.log(`應付金額: $${receipt.summary.dueAmount ?? 0}`);
    if (typeof receipt.summary.pointsChange !== 'undefined') {
      console.log(`點數增減: ${receipt.summary.pointsChange} 點`);
    }
  }
  if (receipt.payment) {
    const p = receipt.payment;
    const paymentMethods = [];
    if (p.cash) paymentMethods.push(`現金: $${p.cash}`);
    if (p.creditCard) paymentMethods.push(`刷卡: $${p.creditCard}`);
    if (p.remittance) paymentMethods.push(`匯款: $${p.remittance}`);
    if (p.linePay) paymentMethods.push(`LINE Pay: $${p.linePay}`);
    if (p.pointsUsed) paymentMethods.push(`扣點: ${p.pointsUsed}點`);
    console.log(`支付方式: ${paymentMethods.join(' / ') || '無'}`);
    console.log(`實收金額: $${p.receivedAmount ?? 0}`);
  }
  console.log(doubleDivider);
  console.log(`[PrintAgent] ✅ 列印工作完成 (${receipt.orderId || receipt.orderNumber})\n`);
}

/**
 * 建立 Print Agent HTTP Server
 */
export function createPrintServer() {
  const server = http.createServer((req, res) => {
    const host = req.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    setPnaHeaders(req, res);

    // 處理 OPTIONS 預檢請求 (Chrome PNA Preflight)
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /health 或 GET /
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        agent: 'onesoul-print-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // POST /print
    if (req.method === 'POST' && pathname === '/print') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
        }
      });

      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const printedAt = new Date().toISOString();
          const job = {
            orderId: payload.orderId || `ord_${Date.now()}`,
            orderNumber: payload.orderNumber || payload.orderId,
            storeId: payload.storeId || 'chupei',
            items: payload.items || [],
            summary: payload.summary || {},
            payment: payload.payment || {},
            printedAt: payload.printedAt || printedAt,
          };

          printReceiptToConsole(job);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            printedAt,
            orderId: job.orderId,
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid JSON payload: ' + (err?.message || 'Unknown error'),
          }));
        }
      });
      return;
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Endpoint ${req.method} ${pathname} does not exist on Print Agent`,
    }));
  });

  return server;
}

export function startServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  const server = createPrintServer();
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      console.log(`[PrintAgent] 🚀 OneSoul Print Agent listening on http://${host}:${port}`);
      console.log(`[PrintAgent] 🔒 Chrome PNA / LNA header support active`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// 支援直接執行: node scripts/print-agent.mjs
const isDirectRun = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);
if (isDirectRun) {
  const port = Number(process.env.PRINT_AGENT_PORT) || DEFAULT_PORT;
  const host = process.env.PRINT_AGENT_HOST || DEFAULT_HOST;
  startServer(port, host).catch(err => {
    console.error('[PrintAgent] ❌ Server failed to start:', err);
    process.exit(1);
  });
}
