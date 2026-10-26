#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Pass Data Cleanliness & Integrity Verifier for OneSoul
Executes 6 comprehensive passes over backend/data/real_migrated_store.json
"""

import json
import re
import sys
import datetime

def verify():
    path = 'backend/data/real_migrated_store.json'
    print(f"🔍 [Pass 1/6] 載入資料庫 Snapshot: {path}...")
    with open(path, 'r', encoding='utf-8') as f:
        store = json.load(f)

    report = {
        'products': {'total': 0, 'issues': []},
        'inventories': {'total': 0, 'issues': []},
        'members': {'total': 0, 'issues': []},
        'orders': {'total': 0, 'item_total': 0, 'issues': []},
        'luckyBags': {'total': 0, 'prizes_total': 0, 'issues': []},
        'sessions': {'total': 0, 'issues': []}
    }

    # ───────────────────────────────────────────────
    # Pass 1: 商品主檔 (Products)
    # ───────────────────────────────────────────────
    products = store.get('products', [])
    report['products']['total'] = len(products)
    prod_ids = set()
    for p in products:
        pid = str(p.get('id', ''))
        name = str(p.get('name', ''))
        cost = p.get('costPrice', 0)
        price = p.get('sellingPrice', 0)
        cat = p.get('category', '')

        if not pid:
            report['products']['issues'].append(f"商品缺少ID: {p}")
        if pid in prod_ids:
            report['products']['issues'].append(f"重複商品ID: {pid}")
        prod_ids.add(pid)

        if not name or name.strip() == '':
            report['products']['issues'].append(f"商品 #{pid} 名稱為空")
        if name.isdigit() and pid not in ('88888', '99999'):
            report['products']['issues'].append(f"商品 #{pid} 品名為純數字: {name}")
        if cost < 0 and pid not in ('88888', '99999'):
            report['products']['issues'].append(f"商品 #{pid} 成本為負數: {cost}")
        if not cat:
            report['products']['issues'].append(f"商品 #{pid} 缺少類別")
        if cat == 'GENERAL' and pid not in ('88888', '99999') and not pid.startswith('SKU-SYS-'):
            report['products']['issues'].append(f"商品 #{pid} 殘留無意義 GENERAL 模糊類別")

    # ───────────────────────────────────────────────
    # Pass 2: 門市庫存 (StoreInventory)
    # ───────────────────────────────────────────────
    inventories = store.get('inventories', [])
    report['inventories']['total'] = len(inventories)
    for inv in inventories:
        pid = str(inv.get('productId', ''))
        store_id = inv.get('storeId', '')
        qty = inv.get('quantity', 0)

        if pid not in prod_ids:
            report['inventories']['issues'].append(f"庫存孤兒商品ID (主檔無此商品): #{pid} (門市:{store_id})")
        if store_id not in ('chupei', 'jinshan'):
            report['inventories']['issues'].append(f"無效門市ID: {store_id} (#{pid})")
        if qty < 0:
            report['inventories']['issues'].append(f"負數庫存: #{pid} ({store_id}) qty={qty}")
        # 高單價異常庫存檢測 (成本 > 1500 且 庫存 > 10)
        prod = next((p for p in products if str(p.get('id')) == pid), None)
        if prod and prod.get('costPrice', 0) > 1500 and qty > 10:
            report['inventories']['issues'].append(f"高單價異常高庫存: #{pid} {prod.get('name')} 成本={prod.get('costPrice')} 庫存={qty}")

    # ───────────────────────────────────────────────
    # Pass 3: 會員主檔 (Members)
    # ───────────────────────────────────────────────
    members = store.get('members', [])
    report['members']['total'] = len(members)
    member_phones = set()
    member_ids = set()
    for m in members:
        mid = str(m.get('id', ''))
        phone = str(m.get('phone', ''))
        pts = m.get('points', 0)

        if not phone:
            report['members']['issues'].append(f"會員缺少電話: {mid}")
        if phone in member_phones:
            report['members']['issues'].append(f"重複會員電話: {phone}")
        member_phones.add(phone)
        member_ids.add(mid)

        # 驗證台灣手機規範或系統特例
        if phone not in ('88888', '99999'):
            if not re.match(r'^09\d{8}$', phone):
                report['members']['issues'].append(f"非規範台灣手機號碼: {phone} (ID:{mid})")

        if pts < 0:
            report['members']['issues'].append(f"會員點數為負數: {phone} pts={pts}")

        bday = m.get('birthday')
        if bday:
            b_match = re.match(r'^(\d{4})/(\d{2})/(\d{2})$', str(bday))
            if not b_match:
                report['members']['issues'].append(f"會員 #{mid} 生日格式非 YYYY/MM/DD: {bday}")
            else:
                y, mon, d = int(b_match.group(1)), int(b_match.group(2)), int(b_match.group(3))
                if y < 1930 or y > 2020:
                    report['members']['issues'].append(f"會員 #{mid} 生日年份超出合理區間(1930~2020): {bday}")
                try:
                    datetime.date(y, mon, d)
                except Exception as e:
                    report['members']['issues'].append(f"會員 #{mid} 生日非合法真實曆法日: {bday} ({e})")

    # ───────────────────────────────────────────────
    # Pass 4: 訂單與銷售歷史 (Orders & OrderItems)
    # ───────────────────────────────────────────────
    orders = store.get('orders', [])
    report['orders']['total'] = len(orders)
    item_count = 0
    for o in orders:
        oid = str(o.get('id', ''))
        mid = o.get('memberId')
        recv_amt = o.get('receivedAmount', 0)
        cash = o.get('cash', 0)
        card = o.get('creditCard', 0)
        remit = o.get('remittance', 0)
        pts_used = o.get('pointsUsed', 0)
        items = o.get('items', [])
        item_count += len(items)

        # 檢驗收付款平帳 (實收必須等於所有支付管道加總)
        if round(recv_amt) != round(cash + card + remit) and recv_amt > 0:
            report['orders']['issues'].append(f"實收金額與支付明細不平帳: {oid} 實收={recv_amt} 支付明細和={cash+card+remit}")

        if recv_amt < 0 or cash < 0 or card < 0 or remit < 0:
            report['orders']['issues'].append(f"訂單頂層金額為負數: {oid} 實收={recv_amt} 現金={cash}")

        sum_items = 0
        for it in items:
            pid = str(it.get('productId', ''))
            amt = it.get('amount', 0)
            if amt < 0:
                report['orders']['issues'].append(f"訂單明細金額為負數: {oid} 品項:{it.get('prizeName') or pid} 金額={amt}")
            if pid and pid not in prod_ids:
                report['orders']['issues'].append(f"訂單明細引用的商品ID在主檔不存在: #{pid} (訂單:{oid})")
            sum_items += amt

    report['orders']['item_total'] = item_count

    # ───────────────────────────────────────────────
    # Pass 5: 一番賞在跑套組 (LuckyBags & LuckyBagPrizes)
    # ───────────────────────────────────────────────
    bags = store.get('luckyBags', [])
    report['luckyBags']['total'] = len(bags)
    prizes = store.get('luckyBagPrizes', [])
    report['luckyBags']['prizes_total'] = len(prizes)

    bag_ids = set()
    for b in bags:
        bid = str(b.get('id', ''))
        bag_ids.add(bid)
        name = str(b.get('name', ''))
        if '海賊王一番賞新年' in name or bid == 'LB-2026-01':
            report['luckyBags']['issues'].append(f"殘留假套組: {bid} {name}")

    for pr in prizes:
        bid = str(pr.get('bagId', ''))
        if bid not in bag_ids:
            report['luckyBags']['issues'].append(f"籤位對應孤兒套組ID: {bid} 獎項:{pr.get('name')}")
        pid = str(pr.get('productId', ''))
        if pid and pid not in prod_ids and pid not in ('0P', '1P', 'X'):
            report['luckyBags']['issues'].append(f"籤位對應商品ID在主檔不存在: #{pid}")

    # ───────────────────────────────────────────────
    # Pass 6: 開關帳日結班次 (Sessions)
    # ───────────────────────────────────────────────
    sessions = store.get('sessions', [])
    report['sessions']['total'] = len(sessions)
    for s in sessions:
        sid = str(s.get('id', ''))
        store_id = s.get('storeId', '')
        if store_id not in ('chupei', 'jinshan'):
            report['sessions']['issues'].append(f"班次無效門市: {store_id} ({sid})")

    # ───────────────────────────────────────────────
    # 總結輸出報告
    # ───────────────────────────────────────────────
    print("=" * 60)
    print("📋 OneSoul 全量資料清洗與完整性驗證報告 (6-Pass Verification)")
    print("=" * 60)
    all_clean = True
    for domain, res in report.items():
        issue_cnt = len(res['issues'])
        status = "✅ 100% 乾淨無瑕" if issue_cnt == 0 else f"⚠️ 發現 {issue_cnt} 項瑕疵"
        print(f"[{domain.upper()}] 總筆數: {res.get('total')}, 明細數: {res.get('item_total', res.get('prizes_total', '-'))} -> {status}")
        if issue_cnt > 0:
            all_clean = False
            for iss in res['issues'][:8]:
                print(f"   • {iss}")
            if issue_cnt > 8:
                print(f"   • ...還有 {issue_cnt - 8} 筆略過")
    print("=" * 60)
    if all_clean:
        print("🎉 驗證結論: 全量資料在加入資料庫前已 100% 清洗完畢，無孤兒關聯、無欄位錯位、無異常負數！")
    else:
        print("⚠️ 驗證結論: 存在待修復或待定義業務規則之資料項目。")

if __name__ == '__main__':
    verify()
