export interface ExportMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  agentName: string | null;
  promptRole: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string; // ISO string
}

export interface ExportData {
  roomName: string;
  topic: string | null;
  agents: Array<{ name: string; promptRole: string; model: string }>;
  messages: ExportMessage[];
  tokenTotals: { input: number; output: number };
  summary: string | null;
  exportedAt: string; // ISO string
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatMarkdownExport(data: ExportData): string {
  const lines: string[] = [];

  lines.push(`# ${data.roomName}`);
  lines.push('');

  if (data.topic) {
    lines.push(`**Topic:** ${data.topic}`);
    lines.push('');
  }

  const agentList = data.agents
    .map((a) => `${a.name} (${a.promptRole}, ${a.model})`)
    .join(', ');
  lines.push(`**Agents:** ${agentList}`);
  lines.push(`**Total tokens:** ${data.tokenTotals.input} input / ${data.tokenTotals.output} output`);
  lines.push(`**Exported:** ${new Date(data.exportedAt).toLocaleString()}`);
  lines.push('');

  if (data.summary) {
    lines.push('---');
    lines.push('');
    lines.push('> **Summary**');
    lines.push('>');
    for (const line of data.summary.split('\n')) {
      lines.push(`> ${line}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Conversation');
  lines.push('');

  for (const msg of data.messages) {
    if (msg.role === 'user') {
      lines.push(`**You:** ${msg.content}`);
    } else if (msg.role === 'agent') {
      lines.push(
        `**${msg.agentName}** (${msg.promptRole}, ${msg.model}): ${msg.content}`,
      );
    } else {
      lines.push(`*System: ${msg.content}*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatJsonExport(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}
