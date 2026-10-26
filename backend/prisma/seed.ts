import { PrismaClient, SessionStatus } from '@prisma/client';

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
    { id: '88888', name: '手動加點 (隨便加)', category: 'GENERAL', isSpecial: true, suggestedPoints: 0 },
    { id: '99999', name: '手動扣點 (隨便扣)', category: 'GENERAL', isSpecial: true, suggestedPoints: 0 },
    { id: '2905', name: 'WAWA飛翔坊寶寶A款', category: 'GK', costPrice: 1200, sellingPrice: 2200, suggestedPoints: 80 },
    { id: '2906', name: 'WAWA飛翔坊寶寶B款', category: 'GK', costPrice: 1200, sellingPrice: 2200, suggestedPoints: 80 },
    { id: 'GK002', name: 'A賞 自在極意功悟空', category: 'GK', costPrice: 1500, sellingPrice: 3000, suggestedPoints: 120 },
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
    { storeId: 'chupei', productId: '2905', quantity: 5, safetyStock: 1 },
    { storeId: 'chupei', productId: '2906', quantity: 3, safetyStock: 1 },
    { storeId: 'chupei', productId: 'GK002', quantity: 2, safetyStock: 1 },
    { storeId: 'jinshan', productId: '2905', quantity: 2, safetyStock: 1 },
    { storeId: 'jinshan', productId: '2906', quantity: 1, safetyStock: 1 },
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

  // 4. 盲盒資料庫 (若 schema 定義 blindBox 則植入，否則跳過)
  if ((prisma as any).blindBox) {
    await (prisma as any).blindBox.upsert({
      where: { id: 'BOX-2905' },
      update: {},
      create: {
        id: 'BOX-2905',
        name: 'WAWA飛翔坊寶寶 盲盒',
        points: 10,
        manualPrice: 350,
        autoSuggestPrice: 350,
        cost: 200,
        prizePoints: 10,
        inventory: 30,
        configuring: 0,
        shipped: 0,
        remaining: 30,
        remark: '真實進貨',
      },
    });
  }

  // 5. 福袋與獎項庫 (竹北店 - 真實 WAWA飛翔坊寶寶A款)
  const bag1 = await prisma.luckyBag.upsert({
    where: { id: 'LB-chupei-1548' },
    update: {},
    create: {
      id: 'LB-chupei-1548',
      storeId: 'chupei',
      name: 'WAWA飛翔坊寶寶A款',
      unitPrice: 350,
      isPointsSet: false,
    },
  });

  const prizes1 = [
    { bagId: bag1.id, prizeGrade: '1', prizeName: 'WAWA飛翔坊寶寶A款', productId: '2905', points: 80, draws: 1, drawnCount: 0 },
    { bagId: bag1.id, prizeGrade: '2', prizeName: 'WAWA飛翔坊寶寶B款', productId: '2906', points: 80, draws: 1, drawnCount: 0 },
  ];

  for (const p of prizes1) {
    const existing = await prisma.luckyBagPrize.findFirst({
      where: { bagId: p.bagId, prizeGrade: p.prizeGrade },
    });
    if (!existing) {
      await prisma.luckyBagPrize.create({ data: p });
    }
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
    const existing = await prisma.luckyBagPrize.findFirst({
      where: { bagId: p.bagId, prizeGrade: p.prizeGrade },
    });
    if (!existing) {
      await prisma.luckyBagPrize.create({ data: p });
    }
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
