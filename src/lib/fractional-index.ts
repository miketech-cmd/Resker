const BASE62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BASE62_DIGITS.length;
const FIRST_DIGIT = BASE62_DIGITS[0]!;
const ZERO_CHAR = FIRST_DIGIT;

/**
 * Fractional indexing using lexicographically sorted Base62 strings.
 * Adapted for single-row list item reordering without renumbering neighbors.
 */
function charIndex(ch: string | undefined): number {
  if (!ch) return 0;
  const idx = BASE62_DIGITS.indexOf(ch);
  return idx === -1 ? 0 : idx;
}

function midpointDigits(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new Error(`Invalid bounds: "${a}" >= "${b}"`);
  }

  let i = 0;
  let prefix = "";

  while (true) {
    const digA = i < a.length ? charIndex(a[i]) : 0;
    const digB = b !== null ? (i < b.length ? charIndex(b[i]) : BASE) : BASE;

    if (digB - digA > 1) {
      const mid = Math.round((digA + digB) / 2);
      // Ensure mid strictly stays inside (digA, digB)
      const clamped = mid === digB ? digB - 1 : mid === digA ? digA + 1 : mid;
      return prefix + BASE62_DIGITS[clamped]!;
    }

    const chA = i < a.length ? a[i]! : ZERO_CHAR;
    prefix += chA;
    i += 1;

    // If advancing past a with no upper bound or when a is prefix of b, pick a midpoint
    if (b === null && i > a.length) {
      return prefix + BASE62_DIGITS[Math.floor(BASE / 2)]!;
    }
  }
}

export function isValidPositionKey(key: string): boolean {
  if (!key || key.length > 64) return false;
  for (let i = 0; i < key.length; i++) {
    if (!BASE62_DIGITS.includes(key[i]!)) return false;
  }
  return true;
}

/**
 * Generates a Base62 string lexicographically strictly between `a` and `b`.
 * Pass `null` for either bound to generate at the start or end.
 */
export function generateKeyBetween(a: string | null, b: string | null): string {
  if (a === null && b === null) {
    return "a0";
  }

  if (a === null && b !== null) {
    // Generate key strictly smaller than b while keeping key length small
    let firstNonZero = 0;
    while (firstNonZero < b.length && b[firstNonZero] === FIRST_DIGIT) {
      firstNonZero += 1;
    }

    if (firstNonZero >= b.length) {
      // Degenerate all-zero upper bound; fallback cleanly
      return FIRST_DIGIT.repeat(b.length) + "V";
    }

    const ch = charIndex(b[firstNonZero]);
    if (ch > 1) {
      const mid = Math.floor(ch / 2);
      return b.slice(0, firstNonZero) + BASE62_DIGITS[mid]!;
    }

    // b starts with "...1..." so append trailing zeros up to index + midpoint
    return b.slice(0, firstNonZero) + FIRST_DIGIT + BASE62_DIGITS[Math.floor(BASE / 2)]!;
  }

  if (a !== null && b === null) {
    // Bump trailing char or append midpoint for fast ascending keys
    for (let i = a.length - 1; i >= 0; i--) {
      const idx = charIndex(a[i]);
      if (idx < BASE - 1) {
        const nextIdx = Math.min(BASE - 1, idx + 8);
        return a.slice(0, i) + BASE62_DIGITS[nextIdx]!;
      }
    }
    return a + BASE62_DIGITS[Math.floor(BASE / 2)]!;
  }

  // Both bounds provided
  const lower = a!;
  const upper = b!;
  if (lower < upper) {
    const result = midpointDigits(lower, upper);
    if (result > lower && result < upper) {
      return result;
    }
  }

  // Fallback for unexpected equal/inverted bounds
  return `${lower}${BASE62_DIGITS[Math.floor(BASE / 2)]!}`;
}

export function generateNKeysBetween(a: string | null, b: string | null, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [generateKeyBetween(a, b)];

  const keys: string[] = [];
  let cursor = a;
  for (let i = 0; i < count; i++) {
    const remaining = count - i;
    if (remaining === 1) {
      cursor = generateKeyBetween(cursor, b);
    } else if (b === null) {
      cursor = generateKeyBetween(cursor, null);
    } else {
      cursor = generateKeyBetween(cursor, b);
    }
    keys.push(cursor);
  }
  return keys;
}
