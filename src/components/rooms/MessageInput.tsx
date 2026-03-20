'use client';

import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

interface MessageInputProps {
  roomId: string;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const content = value.trim();
    if (!content) return;

    // Clear immediately for responsive UX
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const msg = await res.json();
      // Optimistic insert: SSE may arrive late — dedup prevents doubles
      useChatStore.getState().addUserMessage({
        id: msg.id,
        content: msg.content,
        createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : new Date(msg.createdAt).toISOString(),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="border-t bg-background px-4 py-3 flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm min-h-[40px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring bg-background"
      />
      <button
        onClick={send}
        disabled={!value.trim()}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex-shrink-0"
        aria-label="Send message"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
