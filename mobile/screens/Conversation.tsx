import React from 'react';
import { SocketProvider } from '../hooks/useSocket';
import { ChatProvider } from '../hooks/useChat';
import Chat from '../components/partials/chat/Chat';

export default function Conversation() {
  return (
    <SocketProvider>
      <ChatProvider>
        <Chat />
      </ChatProvider>
    </SocketProvider>
  );
}
