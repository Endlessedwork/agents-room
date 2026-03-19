import { db } from './index';
import { providerKeys } from './schema';

const PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'] as const;

async function seed() {
  for (const provider of PROVIDERS) {
    await db
      .insert(providerKeys)
      .values({
        provider,
        status: 'unconfigured',
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }
  console.log('Seeded provider_keys with 5 default providers');
}

seed().catch(console.error);
