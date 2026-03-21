import { db } from './index';
import { providerKeys, presets } from './schema';
import { AGENT_PRESETS } from '@/components/agents/AgentPresets';

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

  for (const preset of AGENT_PRESETS) {
    await db
      .insert(presets)
      .values({
        id: preset.id,
        name: preset.name,
        avatarColor: preset.avatarColor,
        avatarIcon: preset.avatarIcon,
        promptRole: preset.promptRole,
        promptPersonality: preset.promptPersonality,
        promptRules: preset.promptRules,
        promptConstraints: preset.promptConstraints,
        provider: preset.provider,
        model: preset.model,
        temperature: preset.temperature,
        isSystem: true,
      })
      .onConflictDoNothing();
  }
  console.log('Seeded presets with 3 system presets');
}

seed().catch(console.error);
