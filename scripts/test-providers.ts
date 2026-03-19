/**
 * Manual integration test script for verifying all 5 LLM providers.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... npx tsx scripts/test-providers.ts
 *
 * This script is for manual verification ONLY.
 * It is NOT run in CI or automated tests.
 */

import { generateLLM } from '../src/lib/llm/gateway';
import type { ProviderName } from '../src/lib/llm/providers';

const TEST_MESSAGE = [
  { role: 'user' as const, content: 'Reply with exactly one word: hello' },
];

interface ProviderTestConfig {
  provider: ProviderName;
  model: string;
  keyEnvVar: string | null; // null = no key needed (Ollama)
}

const PROVIDERS: ProviderTestConfig[] = [
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    keyEnvVar: 'ANTHROPIC_API_KEY',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    keyEnvVar: 'OPENAI_API_KEY',
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    keyEnvVar: 'GOOGLE_API_KEY',
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    keyEnvVar: 'OPENROUTER_API_KEY',
  },
  {
    provider: 'ollama',
    model: 'llama3.2',
    keyEnvVar: null, // No API key needed — uses local server
  },
];

async function testProvider(config: ProviderTestConfig): Promise<void> {
  const { provider, model, keyEnvVar } = config;

  // Check if API key is available (skip if not configured)
  if (keyEnvVar !== null) {
    const apiKey = process.env[keyEnvVar];
    if (!apiKey) {
      console.log(`[${provider}] SKIPPED: no API key (set ${keyEnvVar})`);
      return;
    }

    try {
      const response = await generateLLM({
        provider,
        model,
        config: { apiKey },
        messages: TEST_MESSAGE,
      });
      console.log(`[${provider}] OK: ${response.trim()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[${provider}] FAIL: ${message}`);
    }
  } else {
    // Ollama — keyless, try to connect to local server
    try {
      const response = await generateLLM({
        provider,
        model,
        config: {
          baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
        },
        messages: TEST_MESSAGE,
      });
      console.log(`[${provider}] OK: ${response.trim()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Ollama failing is expected when local server isn't running
      console.log(`[${provider}] FAIL: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('Testing LLM providers...\n');

  for (const config of PROVIDERS) {
    await testProvider(config);
  }

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
