import { PrismaClient, ProductCategory, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始植入 OneSoul POS 種子測試資料...');

  // 1. 門市
  const chupei = await prisma.store.upsert({
    where: { id: 'chupei' },
    update: {},
    create: {
      id: 'chupei',
      name: '竹北店',
      code: 'CHUPEI',
      address: '新竹縣竹北市光明六路',
      phone: '03-5551234',
      isActive: true,
      openTime: '14:00',
      standardHours: 8,
      lateGraceMinutes: 15,
    },
  });

  const jinshan = await prisma.store.upsert({
    where: { id: 'jinshan' },
    update: {},
    create: {
      id: 'jinshan',
      name: '金山店',
      code: 'JINSHAN',
      address: '新竹市東區金山街',
      phone: '03-5789999',
      isActive: true,
      openTime: '16:00',
      standardHours: 6,
      lateGraceMinutes: 15,
    },
  });

  // 2. 特殊虛擬商品 (88888 加點 / 99999 扣點) 與實體商品
  const products = [
    { id: '88888', name: '手動加點 (隨便加)', category: ProductCategory.GENERAL, isSpecial: true, suggestedPoints: 0 },
    { id: '99999', name: '手動扣點 (隨便扣)', category: ProductCategory.GENERAL, isSpecial: true, suggestedPoints: 0 },
    { id: 'GK001', name: '海賊王 魯夫 太陽神尼卡 GK', category: ProductCategory.GK, costPrice: 8000, sellingPrice: 15000, suggestedPoints: 300 },
    { id: 'GK002', name: '七龍珠 孫悟空 自在極意功 GK', category: ProductCategory.GK, costPrice: 6000, sellingPrice: 12000, suggestedPoints: 240 },
    { id: 'BB001', name: 'POP MART 盲盒 (Labubu)', category: ProductCategory.BLIND_BOX, costPrice: 200, sellingPrice: 350, suggestedPoints: 10 },
    { id: 'GEN001', name: '玩獸 品牌壓克力防塵展示盒', category: ProductCategory.GENERAL, costPrice: 150, sellingPrice: 300, suggestedPoints: 5 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }

  // 3. 分店庫存
  const inventories = [
    { storeId: 'chupei', productId: 'GK001', quantity: 5, safetyStock: 1 },
    { storeId: 'chupei', productId: 'GK002', quantity: 3, safetyStock: 1 },
    { storeId: 'chupei', productId: 'BB001', quantity: 20, safetyStock: 5 },
    { storeId: 'chupei', productId: 'GEN001', quantity: 50, safetyStock: 10 },
    { storeId: 'jinshan', productId: 'GK001', quantity: 2, safetyStock: 1 },
    { storeId: 'jinshan', productId: 'GK002', quantity: 1, safetyStock: 1 },
    { storeId: 'jinshan', productId: 'BB001', quantity: 10, safetyStock: 2 },
    { storeId: 'jinshan', productId: 'GEN001', quantity: 30, safetyStock: 5 },
  ];

  for (const inv of inventories) {
    await prisma.storeInventory.upsert({
      where: {
        storeId_productId: { storeId: inv.storeId, productId: inv.productId },
      },
      update: { quantity: inv.quantity },
      create: inv,
    });
  }

  // 4. 盲盒資料庫
  await prisma.blindBox.upsert({
    where: { id: 'BB001' },
    update: {},
    create: {
      id: 'BB001',
      name: 'POP MART 盲盒 (Labubu)',
      points: 10,
      manualPrice: 350,
      autoSuggestPrice: 350,
      cost: 200,
      prizePoints: 10,
      inventory: 30,
      configuring: 0,
      shipped: 0,
      remaining: 30,
      remark: '熱門現貨',
    },
  });

  // 5. 福袋與獎項庫 (竹北店)
  const bag1 = await prisma.luckyBag.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      storeId: 'chupei',
      name: '海賊王一番賞新年特別套',
      unitPrice: 350,
      isPointsSet: false,
    },
  });

  const prizes1 = [
    { bagId: bag1.id, prizeGrade: 'A', prizeName: 'A賞 魯夫 MASTERLISE', productId: 'GK001', points: 150, draws: 2, drawnCount: 0 },
    { bagId: bag1.id, prizeGrade: 'B', prizeName: 'B賞 索隆 MASTERLISE', productId: null, points: 100, draws: 3, drawnCount: 0 },
    { bagId: bag1.id, prizeGrade: 'C', prizeName: 'C賞 娜美 公仔', productId: null, points: 80, draws: 5, drawnCount: 0 },
    { bagId: bag1.id, prizeGrade: 'LAST', prizeName: '最後賞 尼卡特別色', productId: 'GK001', points: 200, draws: 1, drawnCount: 0 },
  ];

  for (const p of prizes1) {
    await prisma.luckyBagPrize.upsert({
      where: {
        bagId_prizeGrade: { bagId: p.bagId, prizeGrade: p.prizeGrade },
      },
      update: {},
      create: p,
    });
  }

  // 點數套
  const bag2 = await prisma.luckyBag.upsert({
    where: { id: '2' },
    update: {},
    create: {
      id: '2',
      storeId: 'chupei',
      name: '七龍珠一番賞點數特惠套',
      unitPrice: 300,
      isPointsSet: true,
    },
  });

  const prizes2 = [
    { bagId: bag2.id, prizeGrade: 'A', prizeName: 'A賞 自在極意功悟空', productId: 'GK002', points: 120, draws: 2, drawnCount: 0 },
    { bagId: bag2.id, prizeGrade: 'B', prizeName: 'B賞 超藍達爾', productId: null, points: 80, draws: 4, drawnCount: 0 },
  ];

  for (const p of prizes2) {
    await prisma.luckyBagPrize.upsert({
      where: {
        bagId_prizeGrade: { bagId: p.bagId, prizeGrade: p.prizeGrade },
      },
      update: {},
      create: p,
    });
  }

  // 6. 測試會員
  const members = [
    { phone: '0912345678', name: '王小明', gender: '男', birthday: '1995/08/15', points: 500, note: '常客，偏好GK' },
    { phone: '0987654321', name: '李小華', gender: '女', birthday: '1998/12/20', points: 120, note: '盒玩愛好者' },
    { phone: '0911222333', name: '陳大文', gender: '男', birthday: '2000/01/01', points: 0, note: '新會員' },
  ];

  for (const m of members) {
    await prisma.member.upsert({
      where: { phone: m.phone },
      update: {},
      create: m,
    });
  }

  // 7. 竹北店當前活躍開帳 Session
  const existingSession = await prisma.cashRegisterSession.findFirst({
    where: { storeId: 'chupei', status: SessionStatus.OPEN },
  });

  if (!existingSession) {
    await prisma.cashRegisterSession.create({
      data: {
        storeId: 'chupei',
        openingCash: 3000,
        openedBy: 'onesoul.chupei@gmail.com',
        status: SessionStatus.OPEN,
        note: '今日早班正常開帳',
      },
    });
  }

  console.log('✅ 種子資料植入完成！門市、商品、庫存、福袋套組與會員均已就緒。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
