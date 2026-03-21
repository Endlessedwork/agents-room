import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';
import type { ProviderName } from '@/lib/llm/providers';

export const dynamic = 'force-dynamic';

export interface ModelInfo {
  id: string;
  contextLength?: number;
  capabilities?: string[];
}

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'];

async function fetchAnthropicModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal,
  });
  const data = await res.json();
  return (data.data ?? []).map(
    (m: {
      id: string;
      max_input_tokens?: number;
      capabilities?: {
        image_input?: { supported: boolean };
        thinking?: { supported: boolean };
      };
    }) => {
      const caps: string[] = [];
      if (m.capabilities?.image_input?.supported) caps.push('vision');
      if (m.capabilities?.thinking?.supported) caps.push('thinking');
      return {
        id: m.id,
        contextLength: m.max_input_tokens,
        capabilities: caps,
      };
    },
  );
}

async function fetchOpenAIModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  const data = await res.json();
  return (data.data ?? [])
    .filter((m: { id: string }) => m.id.startsWith('gpt-') || /^o\d/.test(m.id))
    .map((m: { id: string }) => ({ id: m.id }));
}

async function fetchGoogleModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { signal },
  );
  const data = await res.json();
  return (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'),
    )
    .map((m: { name: string; inputTokenLimit?: number }) => ({
      id: m.name.replace('models/', ''),
      contextLength: m.inputTokenLimit,
    }));
}

async function fetchOpenRouterModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  const data = await res.json();
  return (data.data ?? []).map(
    (m: {
      id: string;
      context_length?: number;
      architecture?: { input_modalities?: string[] };
    }) => {
      const caps: string[] = [];
      if (m.architecture?.input_modalities?.includes('image')) caps.push('vision');
      if (m.context_length && m.context_length >= 100000) {
        caps.push(`${Math.round(m.context_length / 1000)}k`);
      }
      return { id: m.id, contextLength: m.context_length, capabilities: caps };
    },
  );
}

async function fetchOllamaModels(baseUrl: string | null, signal: AbortSignal): Promise<ModelInfo[]> {
  const host = (baseUrl ?? 'http://localhost:11434').replace(/\/api$/, '');
  const res = await fetch(`${host}/api/tags`, { signal });
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string }) => ({ id: m.name }));
}

function fetchModelsForProvider(
  provider: string,
  keyRow: { apiKey: string | null; baseUrl: string | null } | undefined,
  signal: AbortSignal,
): Promise<ModelInfo[]> {
  switch (provider) {
    case 'anthropic':
      return fetchAnthropicModels(keyRow!.apiKey!, signal);
    case 'openai':
      return fetchOpenAIModels(keyRow!.apiKey!, signal);
    case 'google':
      return fetchGoogleModels(keyRow!.apiKey!, signal);
    case 'openrouter':
      return fetchOpenRouterModels(keyRow!.apiKey!, signal);
    case 'ollama':
      return fetchOllamaModels(keyRow?.baseUrl ?? null, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const providerName = provider as ProviderName;

  const [keyRow] = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.provider, providerName));

  if (!keyRow?.apiKey && providerName !== 'ollama') {
    return NextResponse.json({ error: 'Not configured' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const models = await fetchModelsForProvider(providerName, keyRow ?? undefined, controller.signal);
    clearTimeout(timeout);
    models.sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ models });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
