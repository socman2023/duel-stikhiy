/** xorshift32. НЕ предназначен для криптографии; пригоден для повторяемых игровых тестов. */
export class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = (seed | 0) || 0x6d2b79f5; }
  next(): number {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x | 0;
    return (x >>> 0) / 4294967296;
  }
  index(length: number): number {
    if (!Number.isInteger(length) || length <= 0) throw new Error('Некорректный диапазон выбора');
    return Math.floor(this.next() * length);
  }
  pick<T>(xs: readonly T[]): T { const selected = xs[this.index(xs.length)]; if (selected === undefined) throw new Error('Empty choice'); return selected; }
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) { const j = this.index(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  }
}
