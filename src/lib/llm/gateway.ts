import { streamText, generateText } from 'ai';
import { getModel, type ProviderName, type ProviderConfig } from './providers';

export interface LLMRequest {
  provider: ProviderName;
  model: string;
  config: ProviderConfig;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  abortSignal?: AbortSignal;
}

// Streaming — for agent turns in conversation
export function streamLLM(request: LLMRequest) {
  const model = getModel(request.provider, request.model, request.config);
  return streamText({
    model,
    system: request.system,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    abortSignal: request.abortSignal,
  });
}

// Non-streaming — for connection testing, quick verifications
export async function generateLLM(request: LLMRequest): Promise<string> {
  const model = getModel(request.provider, request.model, request.config);
  const result = await generateText({
    model,
    system: request.system,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    abortSignal: request.abortSignal,
  });
  return result.text;
}
