import { NextResponse } from 'next/server';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const ALL_PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'] as const;

export async function GET() {
  try {
    const rows = await db.select().from(providerKeys);

    // Merge with defaults for missing providers
    const providerMap = new Map(rows.map((row) => [row.provider, row]));

    const result = ALL_PROVIDERS.map((provider) => {
      const row = providerMap.get(provider);
      return {
        provider,
        status: row?.status ?? 'unconfigured',
        apiKey: row?.apiKey ? true : false,
        baseUrl: row?.baseUrl ?? null,
        lastTestedAt: row?.lastTestedAt ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/providers]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
