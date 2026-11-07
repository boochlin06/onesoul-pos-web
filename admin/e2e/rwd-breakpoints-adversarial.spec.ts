import { test, expect } from '@playwright/test';

test.describe('Adversarial RWD Breakpoint Verification Suite', () => {

  test.describe('1. Mobile Breakpoint (375px ~ 640px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('M1: Sidebar drawer is off-canvas when closed and slides in when open', async ({ page }) => {
      await page.goto('/#/overview');
      await page.waitForLoadState('domcontentloaded');

      const sidebar = page.locator('aside');
      await expect(sidebar).toBeAttached();

      // Verify closed drawer classes
      const sidebarClass = await sidebar.getAttribute('class') || '';
      expect(sidebarClass).toContain('-translate-x-full');
      expect(sidebarClass).toContain('fixed');
      expect(sidebarClass).toContain('inset-y-0');
      expect(sidebarClass).toContain('left-0');
      expect(sidebarClass).toContain('z-50');
      expect(sidebarClass).toContain('w-64');

      // Verify off-canvas geometry: bounding box must be off-screen to the left
      const closedBox = await sidebar.boundingBox();
      expect(closedBox).not.toBeNull();
      if (closedBox) {
        expect(closedBox.x + closedBox.width).toBeLessThanOrEqual(0);
      }

      // Verify Backdrop does NOT exist in DOM when closed
      const backdropClosed = page.locator('.fixed.inset-0.bg-black\\/60');
      expect(await backdropClosed.count()).toBe(0);

      // Verify Hamburger button is visible
      const hamburger = page.locator('header button[aria-label="切換功能選單"]');
      await expect(hamburger).toBeVisible();
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');

      // Check hamburger button classes
      const hamburgerClass = await hamburger.getAttribute('class') || '';
      expect(hamburgerClass).toContain('md:hidden');

      // Verify main content has 100% full width and no horizontal overflow
      const main = page.locator('main');
      const mainBox = await main.boundingBox();
      expect(mainBox).not.toBeNull();
      if (mainBox) {
        expect(mainBox.x).toBe(0);
        expect(mainBox.width).toBe(375);
      }
      const mainClass = await main.getAttribute('class') || '';
      expect(mainClass).toContain('min-w-0');
      expect(mainClass).toContain('w-full');
      expect(mainClass).toContain('overflow-x-hidden');

      // Open drawer by clicking Hamburger button
      await hamburger.click();

      // Verify Backdrop appears with correct classes
      const backdropOpen = page.locator('.fixed.inset-0.bg-black\\/60');
      await expect(backdropOpen).toBeVisible();
      const backdropClass = await backdropOpen.getAttribute('class') || '';
      expect(backdropClass).toContain('fixed');
      expect(backdropClass).toContain('inset-0');
      expect(backdropClass).toContain('z-40');
      expect(backdropClass).toContain('md:hidden');

      // Wait for 300ms transition to finish
      await page.waitForTimeout(350);

      // Verify Drawer slides in (translate-x-0)
      const openClass = await sidebar.getAttribute('class') || '';
      expect(openClass).toContain('translate-x-0');
      const openBox = await sidebar.boundingBox();
      expect(openBox).not.toBeNull();
      if (openBox) {
        expect(openBox.x).toBe(0);
        expect(openBox.width).toBe(256);
      }

      // Close drawer via backdrop click
      await backdropOpen.click({ position: { x: 300, y: 300 } });
      await page.waitForTimeout(350); // wait for 300ms transition

      // Verify drawer is back off-screen
      const reclosedBox = await sidebar.boundingBox();
      if (reclosedBox) {
        expect(reclosedBox.x + reclosedBox.width).toBeLessThanOrEqual(0);
      }
      expect(await page.locator('.fixed.inset-0.bg-black\\/60').count()).toBe(0);
    });

    test('M2: Drawer closes on ESC key and on navigation click', async ({ page }) => {
      await page.goto('/#/overview');
      const hamburger = page.locator('header button[aria-label="切換功能選單"]');
      await hamburger.click();

      const sidebar = page.locator('aside');
      expect(await sidebar.getAttribute('class')).toContain('translate-x-0');

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      expect(await sidebar.getAttribute('class')).toContain('-translate-x-full');

      // Open again, click nav item
      await hamburger.click();
      const allocationTab = sidebar.locator('button:has-text("一番賞配賞工作台")');
      await allocationTab.click();
      await page.waitForTimeout(350);

      // Verify navigated and drawer closed
      expect(page.url()).toContain('#/allocation');
      expect(await sidebar.getAttribute('class')).toContain('-translate-x-full');
    });

    test('M3: Allocation view on 375px has no horizontal document overflow', async ({ page }) => {
      await page.goto('/#/allocation');
      await page.waitForLoadState('domcontentloaded');

      // Check document body scrollWidth vs clientWidth
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(375);

      // Check FinancialBottomHUD on 375px
      const hud = page.locator('.fixed.bottom-0');
      await expect(hud).toBeVisible();
      const hudClass = await hud.getAttribute('class') || '';
      expect(hudClass).toContain('fixed');
      expect(hudClass).toContain('bottom-0');
      expect(hudClass).toContain('left-0');
      expect(hudClass).toContain('md:left-64');
      expect(hudClass).toContain('z-30');

      const hudBox = await hud.boundingBox();
      expect(hudBox).not.toBeNull();
      if (hudBox) {
        expect(hudBox.x).toBe(0);
        expect(hudBox.width).toBeLessThanOrEqual(375);
      }
    });
  });

  test.describe('2. Tablet Breakpoint (768px ~ 1024px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('T1: Allocation columns stack vertically and LiveStockRadar is static', async ({ page }) => {
      await page.goto('/#/allocation');
      await page.waitForLoadState('domcontentloaded');

      // Verify grid container classes
      const gridContainer = page.locator('.grid.grid-cols-1.xl\\:grid-cols-12');
      await expect(gridContainer).toBeVisible();
      const gridClass = await gridContainer.getAttribute('class') || '';
      expect(gridClass).toContain('grid-cols-1');
      expect(gridClass).toContain('xl:grid-cols-12');

      // Verify left column and right column containers
      const leftCol = page.locator('.xl\\:col-span-8');
      const rightCol = page.locator('.xl\\:col-span-4');
      await expect(leftCol).toBeVisible();
      await expect(rightCol).toBeVisible();

      const rightColClass = await rightCol.getAttribute('class') || '';
      expect(rightColClass).toContain('static');
      expect(rightColClass).toContain('xl:sticky');
      expect(rightColClass).toContain('xl:top-4');
      expect(rightColClass).toContain('xl:max-h-[calc(100vh-8rem)]');

      // Verify vertical stacking: Right column (radar) top must be below left column bottom
      const leftBox = await leftCol.boundingBox();
      const rightBox = await rightCol.boundingBox();
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();
      if (leftBox && rightBox) {
        // They must NOT be side-by-side (leftBox.x should match rightBox.x approximately)
        expect(rightBox.y).toBeGreaterThanOrEqual(leftBox.y + leftBox.height - 100);
      }

      // Verify LiveStockRadar computed position is static on tablet
      const radarPosition = await rightCol.evaluate((el) => {
        return window.getComputedStyle(el).position;
      });
      expect(radarPosition).toBe('static');

      // Verify LiveStockRadar internal list has bounded max-height and overscroll-contain
      const listContainer = page.locator('.max-h-\\[380px\\], .sm\\:max-h-\\[460px\\]');
      await expect(listContainer).toBeAttached();
      const listStyle = await listContainer.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          maxHeight: s.maxHeight,
          overflowY: s.overflowY,
          overscrollBehavior: s.overscrollBehaviorY || s.overscrollBehavior,
        };
      });
      expect(listStyle.maxHeight).toBe('460px');
      expect(listStyle.overflowY).toBe('auto');
      expect(listStyle.overscrollBehavior).toBe('contain');
    });

    test('T2: Hamburger button is hidden and sidebar is static on tablet (>= 768px)', async ({ page }) => {
      await page.goto('/#/overview');
      await page.waitForLoadState('domcontentloaded');

      // Hamburger button must be hidden at 768px (md:hidden)
      const hamburger = page.locator('header button[aria-label="切換功能選單"]');
      await expect(hamburger).toBeHidden();

      // Sidebar must be visible and static
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      const sidebarStyle = await sidebar.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          position: s.position,
          transform: s.transform,
          width: s.width,
        };
      });
      expect(sidebarStyle.position).toBe('static');
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(sidebarStyle.transform);
      expect(sidebarStyle.width).toBe('256px');
    });
  });

  test.describe('3. Desktop Breakpoint (1280px+)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('D1: Fixed static sidebar and FinancialBottomHUD md:left-64 zero-occlusion', async ({ page }) => {
      await page.goto('/#/allocation');
      await page.waitForLoadState('domcontentloaded');

      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox).not.toBeNull();
      if (sidebarBox) {
        expect(sidebarBox.x).toBe(0);
        expect(sidebarBox.width).toBe(256);
      }

      // Check FinancialBottomHUD
      const hud = page.locator('.fixed.bottom-0');
      await expect(hud).toBeVisible();
      const hudBox = await hud.boundingBox();
      expect(hudBox).not.toBeNull();
      if (hudBox) {
        // Must start at x=256 (md:left-64)
        expect(hudBox.x).toBe(256);
        expect(hudBox.width).toBe(1440 - 256);
      }

      // Verify HUD computed style
      const hudStyle = await hud.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          left: s.left,
          zIndex: s.zIndex,
        };
      });
      expect(hudStyle.left).toBe('256px');
      expect(hudStyle.zIndex).toBe('30');

      // Verify that sidebar bottom items are NOT occluded by the HUD
      const bottomStatusPill = sidebar.locator('text=門市連線正常, text=離線本機工作, button[aria-label="切換深淺模式"]').first();
      if (await bottomStatusPill.count() > 0) {
        const pillBox = await bottomStatusPill.boundingBox();
        if (pillBox && hudBox) {
          // Pill must be strictly to the left of the HUD (x < 256)
          expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(hudBox.x);
        }
      }
    });

    test('D2: LiveStockRadar has sticky positioning enabled at xl (1280px+)', async ({ page }) => {
      await page.goto('/#/allocation');
      await page.waitForLoadState('domcontentloaded');

      // Verify side-by-side layout: left col (8) and right col (4)
      const leftCol = page.locator('.xl\\:col-span-8');
      const rightCol = page.locator('.xl\\:col-span-4');
      const leftBox = await leftCol.boundingBox();
      const rightBox = await rightCol.boundingBox();
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();
      if (leftBox && rightBox) {
        expect(rightBox.x).toBeGreaterThan(leftBox.x);
        expect(rightBox.y).toBeCloseTo(leftBox.y, -1); // top aligned
      }

      // Verify sticky positioning computed style
      const radarStyle = await rightCol.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          position: s.position,
          top: s.top,
        };
      });
      expect(radarStyle.position).toBe('sticky');
      expect(radarStyle.top).toBe('16px'); // xl:top-4 = 1rem = 16px
    });
  });

  test.describe('4. Specific Syntax and Class Verifications', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('SYN-1: Header hamburger button class verification for block vs inline-block', async ({ page }) => {
      await page.goto('/#/overview');
      const hamburger = page.locator('header button[aria-label="切換功能選單"]');
      const classAttr = await hamburger.getAttribute('class') || '';
      
      const computedDisplay = await hamburger.evaluate((el) => {
        return window.getComputedStyle(el).display;
      });

      console.log('Hamburger class attribute:', classAttr);
      console.log('Hamburger computed display:', computedDisplay);

      expect(classAttr).toContain('md:hidden');
      // In CSS, a button inside a flex container has computed display: block
      expect(['block', 'inline-block']).toContain(computedDisplay);
    });
  });
});
