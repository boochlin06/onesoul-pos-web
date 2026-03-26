import { describe, it, expect } from 'vitest';
import {
  decodeJwtPayload,
  getAuthorizedRoles,
  getAllowedBranches,
  isTokenExpired,
  getRefreshDelay,
  parseCredential,
} from '../logic/auth';

// ── Helper：建立假 JWT token ──
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

// ──────────────────────────────────────────────────────
// decodeJwtPayload
describe('decodeJwtPayload', () => {
  it('正常 JWT 回傳解析後的 payload', () => {
    const token = makeJwt({ email: 'test@gmail.com', name: 'Test' });
    const result = decodeJwtPayload(token);
    expect(result.email).toBe('test@gmail.com');
    expect(result.name).toBe('Test');
  });

  it('空字串回傳 null', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('亂碼回傳 null', () => {
    expect(decodeJwtPayload('not.a.jwt')).toBeNull();
  });

  it('只有一段的 token 回傳 null', () => {
    expect(decodeJwtPayload('onlyone')).toBeNull();
  });

  it('處理 base64url 字元 (- 和 _)', () => {
    // base64url 使用 - 和 _ 取代 + 和 /
    const payload = { email: 'user@test.com' };
    const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_');
    const token = `header.${body}.sig`;
    const result = decodeJwtPayload(token);
    expect(result.email).toBe('user@test.com');
  });
});

// ──────────────────────────────────────────────────────
// getAuthorizedRoles
describe('getAuthorizedRoles', () => {
  it('已授權 email 回傳角色陣列', () => {
    const roles = getAuthorizedRoles('onesoul.chupei@gmail.com');
    expect(roles).toContain('竹北');
    expect(roles).toContain('金山');
  });

  it('email 不分大小寫', () => {
    const roles = getAuthorizedRoles('ONESOUL.CHUPEI@GMAIL.COM');
    expect(roles).toContain('竹北');
  });

  it('未授權 email 回傳 null', () => {
    expect(getAuthorizedRoles('hacker@evil.com')).toBeNull();
  });

  it('金山帳號只有金山', () => {
    const roles = getAuthorizedRoles('onesoul.jinsang@gmail.com');
    expect(roles).toEqual(['金山']);
  });
});

// ──────────────────────────────────────────────────────
// getAllowedBranches
describe('getAllowedBranches', () => {
  it('已授權 email 回傳分店陣列', () => {
    expect(getAllowedBranches('onesoul.chupei@gmail.com')).toContain('竹北');
  });

  it('未授權 email 回傳空陣列', () => {
    expect(getAllowedBranches('nobody@test.com')).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────
// isTokenExpired
describe('isTokenExpired', () => {
  it('未過期回傳 false', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }); // 1hr from now
    expect(isTokenExpired(token)).toBe(false);
  });

  it('已過期回傳 true', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 }); // 1min ago
    expect(isTokenExpired(token)).toBe(true);
  });

  it('無 exp claim 回傳 true', () => {
    const token = makeJwt({ email: 'test@g.com' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('無效 token 回傳 true', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('可自訂 now 時間', () => {
    const exp = 1700000000;
    const token = makeJwt({ exp });
    // now 在 exp 之前 → 未過期
    expect(isTokenExpired(token, (exp - 100) * 1000)).toBe(false);
    // now 在 exp 之後 → 已過期
    expect(isTokenExpired(token, (exp + 100) * 1000)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// getRefreshDelay
describe('getRefreshDelay', () => {
  it('距離到期 > 5 分鐘時回傳 expMs - now - 5min', () => {
    const nowMs = Date.now();
    const exp = Math.floor(nowMs / 1000) + 3600; // 1hr from now
    const token = makeJwt({ exp });
    const delay = getRefreshDelay(token, nowMs);
    // 3600s - 300s = 3300s = 3300000ms (±1ms tolerance)
    expect(delay).toBeGreaterThan(3_299_000);
    expect(delay).toBeLessThan(3_301_000);
  });

  it('距離到期 < 5 分鐘時回傳至少 10 秒', () => {
    const nowMs = Date.now();
    const exp = Math.floor(nowMs / 1000) + 60; // 1min from now
    const token = makeJwt({ exp });
    const delay = getRefreshDelay(token, nowMs);
    expect(delay).toBe(10_000);
  });

  it('已過期回傳 null', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(getRefreshDelay(token)).toBeNull();
  });

  it('無 exp 回傳 null', () => {
    const token = makeJwt({ email: 'x@y.com' });
    expect(getRefreshDelay(token)).toBeNull();
  });

  it('無效 token 回傳 null', () => {
    expect(getRefreshDelay('bad')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────
// parseCredential
describe('parseCredential', () => {
  it('有效 credential 回傳 authUser', () => {
    const token = makeJwt({ email: 'onesoul.chupei@gmail.com', name: 'Manager', picture: 'https://pic.jpg' });
    const { authUser, error } = parseCredential(token);
    expect(error).toBeNull();
    expect(authUser).not.toBeNull();
    expect(authUser!.email).toBe('onesoul.chupei@gmail.com');
    expect(authUser!.name).toBe('Manager');
    expect(authUser!.picture).toBe('https://pic.jpg');
    expect(authUser!.idToken).toBe(token);
  });

  it('缺 email 回傳錯誤', () => {
    const token = makeJwt({ name: 'No Email' });
    const { authUser, error } = parseCredential(token);
    expect(authUser).toBeNull();
    expect(error).toContain('無法解析');
  });

  it('email 未授權回傳錯誤', () => {
    const token = makeJwt({ email: 'hacker@evil.com' });
    const { authUser, error } = parseCredential(token);
    expect(authUser).toBeNull();
    expect(error).toContain('不在授權名單');
  });

  it('email 大小寫不敏感', () => {
    const token = makeJwt({ email: 'ONESOUL.CHUPEI@GMAIL.COM', name: 'Test' });
    const { authUser, error } = parseCredential(token);
    expect(error).toBeNull();
    expect(authUser!.email).toBe('onesoul.chupei@gmail.com');
  });

  it('無 name 時用 email 作為 name', () => {
    const token = makeJwt({ email: 'onesoul.chupei@gmail.com' });
    const { authUser } = parseCredential(token);
    expect(authUser!.name).toBe('onesoul.chupei@gmail.com');
  });

  it('無 picture 時為空字串', () => {
    const token = makeJwt({ email: 'onesoul.chupei@gmail.com' });
    const { authUser } = parseCredential(token);
    expect(authUser!.picture).toBe('');
  });

  it('無效 token 回傳錯誤', () => {
    const { authUser, error } = parseCredential('garbage');
    expect(authUser).toBeNull();
    expect(error).toContain('無法解析');
  });
});
