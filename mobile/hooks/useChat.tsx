import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useSocket } from './useSocket';
import { sha256 } from '../utils/sha256';
import { Message } from '../@types/Message';

const ChatContext = createContext<{
  conversationDate: Date;
  setConversationDate: React.Dispatch<React.SetStateAction<Date>>;
  conversationDateString: string;
  setConversationDateString: React.Dispatch<React.SetStateAction<string>>;
  conversation: {
    messages: Message[];
    checksum: string;
  };
  setConversation: React.Dispatch<
    React.SetStateAction<{
      messages: Message[];
      checksum: string;
    }>
  >;
  sendMessage: (message: string) => void;
  getMessages: (fromDate: string, toDate: string) => void;
}>({
  conversationDate: new Date(),
  setConversationDate: () => undefined,
  conversationDateString: new Date().toISOString().split('T')[0],
  setConversationDateString: () => undefined,
  conversation: {
    messages: [],
    checksum: '',
  },
  setConversation: () => undefined,
  sendMessage: () => undefined,
  getMessages: () => undefined,
});

export function useChat() {
  return useContext(ChatContext);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const connection = useSocket();

  const [conversationDate, setConversationDate] = useState<Date>(new Date());

  const [conversationDateString, setConversationDateString] = useState<string>(
    conversationDate.toISOString().split('T')[0],
  );

  const [conversation, setConversation] = useState<{
    messages: Message[];
    checksum: string;
  }>({
    messages: [],
    checksum: '',
  });

  const sendMessage = useCallback(
    (message: string) => {
      if (!connection.socket || !connection.connected) {
        return;
      }

      connection.socket.emit('message', {
        message,
      });
    },
    [connection.connected, connection.socket],
  );

  const getMessages = useCallback(
    (fromDate: string, toDate: string) => {
      if (!connection.socket || !connection.connected) {
        return;
      }

      connection.socket.emit('getMessages', {
        fromDate,
        toDate,
      });
    },
    [connection.connected, connection.socket],
  );

  useEffect(() => {
    if (!connection.socket) {
      return;
    }

    connection.socket.on('getMessages', response => {
      setConversation({
        messages: response,
        checksum: sha256(JSON.stringify(response)),
      });
    });

    connection.socket.on('refreshMessages', () => {
      getMessages(conversationDateString, conversationDateString);
    });
  }, [connection.socket, conversation, conversationDateString, getMessages]);

  return (
    <ChatContext.Provider
      value={{
        conversationDate,
        setConversationDate,
        conversationDateString,
        setConversationDateString,
        conversation,
        setConversation,
        sendMessage,
        getMessages,
      }}>
      {children}
    </ChatContext.Provider>
  );
}
