import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string; // Ollama custom host
}

export function getModel(
  provider: ProviderName,
  model: string,
  config: ProviderConfig,
): LanguageModel {
  switch (provider) {
    case 'anthropic': {
      const p = createAnthropic({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'openai': {
      const p = createOpenAI({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'google': {
      const p = createGoogleGenerativeAI({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'openrouter': {
      const p = createOpenRouter({ apiKey: config.apiKey! });
      return p.chat(model);
    }
    case 'ollama': {
      const p = createOllama({
        baseURL: config.baseUrl ?? 'http://localhost:11434/api',
      });
      return p(model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
