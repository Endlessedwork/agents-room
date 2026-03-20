import { describe, expect, it } from 'vitest';
import { calculateCost, formatCost } from '@/lib/pricing';
import type { CostResult } from '@/lib/pricing';

describe('calculateCost', () => {
  it('returns dollars for a known anthropic model', () => {
    const result = calculateCost('anthropic', 'claude-3-5-haiku-20241022', 1000, 500);
    expect(result.type).toBe('dollars');
    if (result.type === 'dollars') {
      expect(result.value).toBeGreaterThan(0);
    }
  });

  it('returns dollars for a known openai model', () => {
    const result = calculateCost('openai', 'gpt-4o', 1_000_000, 1_000_000);
    expect(result.type).toBe('dollars');
    if (result.type === 'dollars') {
      expect(result.value).toBeGreaterThan(0);
    }
  });

  it('returns sentinel "—" for a totally unknown model', () => {
    const result = calculateCost('anthropic', 'totally-fake-model-xyz', 1000, 500);
    expect(result).toEqual({ type: 'sentinel', display: '—' });
  });

  it('returns sentinel "local" for ollama provider', () => {
    const result = calculateCost('ollama', 'llama3', 1000, 500);
    expect(result).toEqual({ type: 'sentinel', display: 'local' });
  });

  it('returns sentinel "local" for ollama even when model name matches a known model', () => {
    const result = calculateCost('ollama', 'claude-3-5-haiku-20241022', 1000, 500);
    expect(result).toEqual({ type: 'sentinel', display: 'local' });
  });

  it('returns dollars with value 0 for known model with 0 tokens', () => {
    const result = calculateCost('anthropic', 'claude-3-5-haiku-20241022', 0, 0);
    expect(result).toEqual({ type: 'dollars', value: 0 });
  });
});

describe('formatCost', () => {
  it('formats small dollar amounts with est. prefix and 4 decimal places', () => {
    const result: CostResult = { type: 'dollars', value: 0.0042 };
    expect(formatCost(result)).toBe('est. $0.0042');
  });

  it('formats larger dollar amounts with est. prefix and 2 decimal places', () => {
    const result: CostResult = { type: 'dollars', value: 1.5 };
    expect(formatCost(result)).toBe('est. $1.50');
  });

  it('passes through the "—" sentinel unchanged', () => {
    const result: CostResult = { type: 'sentinel', display: '—' };
    expect(formatCost(result)).toBe('—');
  });

  it('passes through the "local" sentinel unchanged', () => {
    const result: CostResult = { type: 'sentinel', display: 'local' };
    expect(formatCost(result)).toBe('local');
  });
});
