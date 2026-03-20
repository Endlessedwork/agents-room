import { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';

export function useRoomStream(roomId: string) {
  const {
    startTurn,
    appendToken,
    completeTurn,
    cancelTurn,
    addSystemMessage,
    addUserMessage,
    setRoomStatus,
    updateTokenTotals,
  } = useChatStore();

  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/stream`);

    es.addEventListener('turn:start', (e) => {
      startTurn(JSON.parse(e.data));
    });
    es.addEventListener('token', (e) => {
      const { agentId, text } = JSON.parse(e.data);
      appendToken(agentId, text);
    });
    es.addEventListener('turn:end', (e) => {
      const data = JSON.parse(e.data);
      completeTurn(data);
      if (data.inputTokens != null && data.outputTokens != null) {
        updateTokenTotals(data.inputTokens, data.outputTokens);
      }
    });
    es.addEventListener('turn:cancel', () => {
      cancelTurn();
    });
    es.addEventListener('status', (e) => {
      setRoomStatus(JSON.parse(e.data).status);
    });
    es.addEventListener('system', (e) => {
      addSystemMessage(JSON.parse(e.data).content);
    });
    es.addEventListener('user-message', (e) => {
      addUserMessage(JSON.parse(e.data));
    });

    return () => es.close();
  }, [roomId, startTurn, appendToken, completeTurn, cancelTurn, addSystemMessage, addUserMessage, setRoomStatus, updateTokenTotals]);
}
