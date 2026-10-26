import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

describe('廠商預購與長期追蹤管理 (Pre-orders & Procurement Lifecycle)', () => {
  let app: any;

  beforeEach(async () => {
    app = buildApp();
  });

  const authHeaders = {
    'x-caller-email': 'admin@onesoul.com',
  };

  it('1. 應能成功列出預購單清單與統計指標', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/preorders',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.pendingCount).toBeGreaterThanOrEqual(0);
    expect(body.summary.totalDepositPending).toBeGreaterThanOrEqual(0);
  });

  it('2. 應能推薦下一個可用商品貨號', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/preorders/suggest-next-id',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.suggestedId).toBeDefined();
    expect(parseInt(body.suggestedId, 10)).toBeGreaterThan(0);
  });

  it('3. 應能建立全新廠商預購單 (提早預付訂金)', async () => {
    const payload = {
      name: '鬼滅之刃 猗窩座 破壞殺・滅式 X 模玩殿堂',
      version: '高配發光版',
      quantity: 1,
      deposit: 4500,
      supplier: '玩譯',
      targetStoreId: 'chupei',
      note: '預計半年後發貨，到貨入竹北',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/preorders',
      headers: authHeaders,
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe(payload.name);
    expect(body.data.deposit).toBe(4500);
    expect(body.data.status).toBe('PENDING');
  });

  it('4. 核心驗收：補款並驗收入庫，應原子建立商品主檔與門市庫存', async () => {
    // A. 先建一張預購單
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/preorders',
      headers: authHeaders,
      payload: {
        name: '咒術迴戰 五條悟 虛式茈 雕像',
        version: '限定版',
        quantity: 2,
        deposit: 6000,
        supplier: '燃點工作室',
        targetStoreId: 'chupei',
        note: '測試到貨補款',
      },
    });
    const preOrder = createRes.json().data;

    // B. 查詢推薦貨號
    const suggestRes = await app.inject({
      method: 'GET',
      url: '/api/admin/preorders/suggest-next-id',
      headers: authHeaders,
    });
    const assignedPid = suggestRes.json().suggestedId;

    // C. 執行補款並驗收入庫 (訂金 $6,000 + 尾款 $8,000 + 運費 $500 = 總成本 $14,500)
    const receivePayload = {
      finalPayment: 8000,
      shippingFee: 500,
      productId: assignedPid,
      productName: '咒術迴戰 五條悟 虛式茈 雕像 (限定版)',
      allocationCost: 16000, // 配賞成本
      sellingPrice: 18000,
      suggestedPoints: 900,
      storeId: 'chupei',
    };

    const receiveRes = await app.inject({
      method: 'POST',
      url: `/api/admin/preorders/${preOrder.id}/receive`,
      headers: authHeaders,
      payload: receivePayload,
    });

    expect(receiveRes.statusCode).toBe(200);
    const receiveBody = receiveRes.json();
    expect(receiveBody.success).toBe(true);

    // 檢查預購單狀態變為 COMPLETED 且總成本為 14500
    expect(receiveBody.data.preOrder.status).toBe('COMPLETED');
    expect(receiveBody.data.preOrder.totalCost).toBe(14500);
    expect(receiveBody.data.preOrder.productId).toBe(assignedPid);

    // 檢查商品主檔是否建立成功 (成本必須為單隻成本 14500 / 2 = 7250)
    const createdProduct = await prisma.product.findUnique({ where: { id: assignedPid } });
    expect(createdProduct).toBeDefined();
    expect(createdProduct?.costPrice).toBe(7250);
    expect(createdProduct?.allocationCost).toBe(16000);
    expect(createdProduct?.sellingPrice).toBe(18000);

    // 檢查門市庫存是否入庫 2 件
    const inv = await prisma.storeInventory.findUnique({
      where: { storeId_productId: { storeId: 'chupei', productId: assignedPid } },
    });
    expect(inv).toBeDefined();
    expect(inv?.quantity).toBe(2);

    // D. 防呆驗證：已入庫的預購單再次驗收應精確拒絕
    const duplicateRes = await app.inject({
      method: 'POST',
      url: `/api/admin/preorders/${preOrder.id}/receive`,
      headers: authHeaders,
      payload: receivePayload,
    });
    expect(duplicateRes.statusCode).toBe(400);
    expect(duplicateRes.json().message).toContain('不可重複驗收入庫');
  });

  it('5. 應能取消退訂預購單 (工作室砍單)', async () => {
    // 先建一張預購單
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/preorders',
      headers: authHeaders,
      payload: {
        name: '將被砍單的工作室公仔',
        quantity: 1,
        deposit: 2000,
        supplier: '某翻車工作室',
      },
    });
    const poId = createRes.json().data.id;

    // 取消
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/admin/preorders/${poId}/cancel`,
      headers: authHeaders,
      payload: { reason: '工作室產能不足流產退訂' },
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelBody = cancelRes.json();
    expect(cancelBody.success).toBe(true);
    expect(cancelBody.data.status).toBe('CANCELLED');
    expect(cancelBody.data.note).toContain('工作室產能不足流產退訂');

    // 已取消的預購單再次取消或驗收應被拒絕
    const reCancelRes = await app.inject({
      method: 'POST',
      url: `/api/admin/preorders/${poId}/cancel`,
      headers: authHeaders,
      payload: { reason: '重複取消' },
    });
    expect(reCancelRes.statusCode).toBe(400);
  });

  it('6. 防禦碰撞：若指派已存在的商品貨號，應防護拒絕，禁止靜默覆蓋商品主檔', async () => {
    // 先建一張新預購單
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/preorders',
      headers: authHeaders,
      payload: {
        name: '新雕像 A',
        quantity: 1,
        deposit: 3000,
        supplier: '玩譯',
      },
    });
    const poId = createRes.json().data.id;

    // 試圖綁定已存在的真實 GK 貨號 (例如 1001)
    const collisionRes = await app.inject({
      method: 'POST',
      url: `/api/admin/preorders/${poId}/receive`,
      headers: authHeaders,
      payload: {
        finalPayment: 5000,
        productId: '1001', // 1001 已存在於主檔中
        productName: '惡意覆蓋的品名',
      },
    });

    expect(collisionRes.statusCode).toBe(400);
    const body = collisionRes.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('已存在');
  });

  it('7. 散客結帳防護：傳入「散客-竹北」或「WALKIN」時，禁止建立假會員與使用點數', async () => {
    // 散客使用點數結帳應被拒絕
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: authHeaders,
      payload: {
        branch: '竹北',
        customer: { phone: '散客-竹北', name: '散客' },
        lotteries: [],
        merchandises: [],
        payment: {
          receivedAmount: 100,
          cash: 0,
          pointsUsed: 5,
        },
        summary: { dueAmount: 100, pointsChange: -5 },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('散客不可使用點數折抵');

    // 驗證未建立 phone 為「散客」的幽靈會員
    const ghostMember = await prisma.member.findUnique({ where: { phone: '散客' } });
    expect(ghostMember).toBeNull();
  });

  it('8. 散客格式化電話 (111-111, 88-888) 防護：禁止使用點數或建立假會員', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/checkout',
      headers: authHeaders,
      payload: {
        branch: '竹北',
        customer: { phone: '111-111', name: '現場客' },
        lotteries: [],
        merchandises: [],
        payment: {
          receivedAmount: 100,
          cash: 0,
          pointsUsed: 10,
        },
        summary: { dueAmount: 100, pointsChange: -10 },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('散客不可使用點數折抵');

    const ghost = await prisma.member.findUnique({ where: { phone: '111-111' } });
    expect(ghost).toBeNull();
  });
});
