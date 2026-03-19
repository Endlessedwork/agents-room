import { NextResponse } from 'next/server';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';
import type { ProviderName } from '@/lib/llm/providers';
import { saveProviderKeySchema } from '@/lib/validations';

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'];

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const providerName = provider as ProviderName;
    const body = await req.json();
    const parsed = saveProviderKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const status = parsed.data.apiKey ? 'configured' : 'unconfigured';

    await db
      .insert(providerKeys)
      .values({
        provider: providerName,
        apiKey: parsed.data.apiKey ?? null,
        baseUrl: parsed.data.baseUrl ?? null,
        status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: providerKeys.provider,
        set: {
          apiKey: parsed.data.apiKey ?? null,
          baseUrl: parsed.data.baseUrl ?? null,
          status,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[PUT /api/providers/:provider]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
