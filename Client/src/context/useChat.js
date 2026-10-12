import { useContext } from 'react';
import { ChatContext } from './chat-context.js';

export function useChat() {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error('useChat must be used inside ChatProvider');
  return chat;
}
