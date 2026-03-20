import { ModelInfoMap } from 'llm-info';

export type CostResult =
  | { type: 'dollars'; value: number }
  | { type: 'sentinel'; display: '—' | 'local' };

export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostResult {
  if (provider === 'ollama') {
    return { type: 'sentinel', display: 'local' };
  }
  const info = (
    ModelInfoMap as Record<
      string,
      | { pricePerMillionInputTokens?: number; pricePerMillionOutputTokens?: number }
      | undefined
    >
  )[model];
  if (
    !info ||
    info.pricePerMillionInputTokens == null ||
    info.pricePerMillionOutputTokens == null
  ) {
    return { type: 'sentinel', display: '—' };
  }
  const dollars =
    (inputTokens / 1_000_000) * info.pricePerMillionInputTokens +
    (outputTokens / 1_000_000) * info.pricePerMillionOutputTokens;
  return { type: 'dollars', value: dollars };
}

export function formatCost(result: CostResult): string {
  if (result.type === 'sentinel') return result.display;
  if (result.value < 0.01) return `est. $${result.value.toFixed(4)}`;
  return `est. $${result.value.toFixed(2)}`;
}
