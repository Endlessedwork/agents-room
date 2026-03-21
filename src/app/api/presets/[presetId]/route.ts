import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { presets } from '@/db/schema';
import { updatePresetSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  try {
    const { presetId } = await params;
    const result = await db.select().from(presets).where(eq(presets.id, presetId));

    if (result.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (err) {
    console.error('[GET /api/presets/:presetId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  try {
    const { presetId } = await params;
    const body = await req.json();
    const parsed = updatePresetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const existing = await db.select().from(presets).where(eq(presets.id, presetId));

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    const preset = existing[0];
    if (preset.isSystem === true) {
      return NextResponse.json({ error: 'System presets cannot be edited' }, { status: 403 });
    }

    const updated = await db
      .update(presets)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(presets.id, presetId))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error('[PUT /api/presets/:presetId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  try {
    const { presetId } = await params;
    const existing = await db.select().from(presets).where(eq(presets.id, presetId));

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    const preset = existing[0];
    if (preset.isSystem === true) {
      return NextResponse.json({ error: 'System presets cannot be deleted' }, { status: 403 });
    }

    await db.delete(presets).where(eq(presets.id, presetId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/presets/:presetId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
