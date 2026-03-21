import { NextResponse } from 'next/server';
import { desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { presets } from '@/db/schema';
import { createPresetSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const presetList = await db
      .select()
      .from(presets)
      .orderBy(desc(presets.isSystem), asc(presets.createdAt));

    return NextResponse.json(presetList);
  } catch (err) {
    console.error('[GET /api/presets]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createPresetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const id = nanoid();
    const inserted = await db
      .insert(presets)
      .values({
        id,
        name: parsed.data.name,
        avatarColor: parsed.data.avatarColor,
        avatarIcon: parsed.data.avatarIcon,
        promptRole: parsed.data.promptRole,
        promptPersonality: parsed.data.promptPersonality ?? null,
        promptRules: parsed.data.promptRules ?? null,
        promptConstraints: parsed.data.promptConstraints ?? null,
        provider: parsed.data.provider,
        model: parsed.data.model,
        temperature: parsed.data.temperature,
        isSystem: false,
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/presets]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
