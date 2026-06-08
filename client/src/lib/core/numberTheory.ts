/*
 * core/numberTheory.ts — Central number-theory primitives.
 *
 * One home for the arithmetic functions that drive rulesets. Kept dependency-free
 * and pure so they can be used by the turtle engine, the formula evaluator, the
 * Gaussian ruleset, the scan engine, and any future generator.
 *
 * All functions assume integer n >= 1 unless noted; callers guard the UI ranges.
 */

/** Greatest common divisor (Euclidean). */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/** Least common multiple. */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

/** Primality test (trial division — fine for the app's N ranges). */
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/** Prime factorisation as a Map of prime -> exponent. */
export function primeFactorization(n: number): Map<number, number> {
  const f = new Map<number, number>();
  let m = Math.abs(n);
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) {
      f.set(p, (f.get(p) ?? 0) + 1);
      m /= p;
    }
  }
  if (m > 1) f.set(m, (f.get(m) ?? 0) + 1);
  return f;
}

/** Distinct prime factors, ascending. */
export function distinctPrimeFactors(n: number): number[] {
  return Array.from(primeFactorization(n).keys()).sort((a, b) => a - b);
}

/** ω(n) — number of distinct prime factors. */
export function omega(n: number): number {
  return primeFactorization(n).size;
}

/** Ω(n) — number of prime factors counted with multiplicity. */
export function bigOmega(n: number): number {
  let total = 0;
  for (const e of primeFactorization(n).values()) total += e;
  return total;
}

/** All divisors of n including 1 and n, ascending. */
export function divisors(n: number): number[] {
  const small: number[] = [];
  const large: number[] = [];
  const m = Math.abs(n);
  for (let i = 1; i * i <= m; i++) {
    if (m % i === 0) {
      small.push(i);
      if (i !== m / i) large.push(m / i);
    }
  }
  return small.concat(large.reverse());
}

/** τ(n) / d(n) — number of divisors. */
export function tau(n: number): number {
  let count = 1;
  for (const e of primeFactorization(n).values()) count *= e + 1;
  return count;
}

/** σ(n) — sum of divisors. */
export function sigma(n: number): number {
  let result = 1;
  for (const [p, e] of primeFactorization(n)) {
    result *= (Math.pow(p, e + 1) - 1) / (p - 1);
  }
  return result;
}

/** φ(n) — Euler's totient (count of 1..n coprime to n). */
export function phi(n: number): number {
  if (n <= 0) return 0;
  let result = n;
  for (const p of primeFactorization(n).keys()) {
    result -= result / p;
  }
  return Math.round(result);
}

/** μ(n) — Möbius function: 0 if squareful, else (-1)^omega. */
export function mobius(n: number): number {
  if (n === 1) return 1;
  let result = 1;
  for (const e of primeFactorization(n).values()) {
    if (e > 1) return 0;
    result = -result;
  }
  return result;
}

/** rad(n) — product of distinct primes. */
export function radical(n: number): number {
  return distinctPrimeFactors(n).reduce((a, p) => a * p, 1);
}

/** Whether step i "shares a factor" with n — the classic rule predicate. */
export function sharesFactor(i: number, n: number): boolean {
  return gcd(i, n) > 1;
}
