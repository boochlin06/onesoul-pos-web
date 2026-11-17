/**
 * PhoneNumber Value Object
 * Handles phone normalization, leading zero parity, and Walk-In identification.
 */

export class PhoneNumber {
  public static readonly WALK_IN_CODES = new Set([
    '111111',
    '222222',
    '333333',
    '88888',
    '99999',
    '000000',
    '888888',
    '999999',
    'WALKIN',
  ]);

  public static readonly WALKIN_PHONE = new PhoneNumber('WALKIN');

  public static canonical(rawInput?: string | null): string {
    return new PhoneNumber(rawInput).canonical;
  }

  private static readonly WALK_IN_REGEX = /散客|WALKIN|現場|\u975e\u6703\u54e1|\u81e8\u6642\u5ba2|\u8a2a\u5ba2/i;

  private readonly _value: string;
  private readonly _canonical: string;
  private readonly _isWalkIn: boolean;

  constructor(rawInput?: string | null) {
    if (!rawInput || typeof rawInput !== 'string') {
      this._value = 'WALKIN';
      this._canonical = 'WALKIN';
      this._isWalkIn = true;
      return;
    }

    const clean = rawInput.trim();
    const upper = clean.toUpperCase();
    const raw = upper.split(/[- ]/)[0].trim();
    const stripped = upper.replace(/[-_\s]/g, '');

    const isWalkInMatch =
      PhoneNumber.WALK_IN_CODES.has(upper) ||
      PhoneNumber.WALK_IN_CODES.has(raw) ||
      PhoneNumber.WALK_IN_CODES.has(stripped) ||
      PhoneNumber.WALK_IN_REGEX.test(clean);

    if (isWalkInMatch) {
      this._value = 'WALKIN';
      this._canonical = 'WALKIN';
      this._isWalkIn = true;
      return;
    }

    this._isWalkIn = false;
    this._value = stripped;

    // Taiwan mobile canonical form: normalize 9 digits without leading 0 to 10 digits with leading 0
    if (/^9\d{8}$/.test(stripped)) {
      this._canonical = `0${stripped}`;
    } else {
      this._canonical = stripped;
    }
  }

  get isWalkIn(): boolean {
    return this._isWalkIn;
  }

  get value(): string {
    return this._value;
  }

  get canonical(): string {
    return this._canonical;
  }

  toString(): string {
    return this._value;
  }

  equals(other: PhoneNumber | string): boolean {
    if (typeof other === 'string') {
      const otherVo = new PhoneNumber(other);
      return this.matchesCanonical(otherVo.canonical);
    }
    return this.matchesCanonical(other.canonical);
  }

  private matchesCanonical(targetCanonical: string): boolean {
    if (this._isWalkIn && targetCanonical === 'WALKIN') return true;
    if (this._isWalkIn || targetCanonical === 'WALKIN') return false;

    // Check direct equality or leading 0 parity
    if (this._canonical === targetCanonical) return true;
    const strippedThis = this._canonical.replace(/^0+/, '');
    const strippedTarget = targetCanonical.replace(/^0+/, '');
    return strippedThis.length >= 7 && strippedThis === strippedTarget;
  }
}
