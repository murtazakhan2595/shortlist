/** A cost in US dollars. Single calls cost fractions of a cent, so small amounts keep four decimals. */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount < 1 ? 4 : 2)}`;
}
