import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';
import { generateLLM } from '@/lib/llm/gateway';
import type { ProviderName } from '@/lib/llm/providers';

export const dynamic = 'force-dynamic';

const DEFAULT_TEST_MODELS: Record<string, string> = {
  anthropic: 'claude-3-haiku-20240307',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  ollama: 'llama3.2',
};

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'];

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
      return NextResponse.json({ ok: false, error: 'Invalid provider' }, { status: 400 });
    }

    const providerName = provider as ProviderName;
    const keyRow = await db.query.providerKeys.findFirst({
      where: eq(providerKeys.provider, providerName),
    });

    if (!keyRow?.apiKey && providerName !== 'ollama') {
      return NextResponse.json(
        { ok: false, error: 'No API key configured' },
        { status: 400 },
      );
    }

    try {
      const text = await generateLLM({
        provider: providerName,
        model: DEFAULT_TEST_MODELS[providerName],
        config: {
          apiKey: keyRow?.apiKey ?? undefined,
          baseUrl: keyRow?.baseUrl ?? undefined,
        },
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      });

      await db
        .update(providerKeys)
        .set({ status: 'verified', lastTestedAt: new Date() })
        .where(eq(providerKeys.provider, providerName));

      return NextResponse.json({ ok: true, text });
    } catch (err: unknown) {
      await db
        .update(providerKeys)
        .set({ status: 'failed' })
        .where(eq(providerKeys.provider, providerName));

      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  } catch (err) {
    console.error('[POST /api/providers/:provider/test]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
