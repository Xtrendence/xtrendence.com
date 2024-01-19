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

export const emptyConversation = {
  messages: [],
  checksum: '',
  scroll: false,
};

const ChatContext = createContext<{
  conversationDate: Date;
  setConversationDate: React.Dispatch<React.SetStateAction<Date>>;
  conversationDateString: string;
  setConversationDateString: React.Dispatch<React.SetStateAction<string>>;
  conversation: {
    messages: Message[];
    checksum: string;
    scroll: boolean;
  };
  setConversation: React.Dispatch<
    React.SetStateAction<{
      messages: Message[];
      checksum: string;
      scroll: boolean;
    }>
  >;
  sendMessage: (message: string) => void;
  sortMessages: (messages: Message[]) => Message[];
  getMessages: (fromDate: string, toDate: string) => void;
  getLastMessagesByLimit: (limit: number) => void;
}>({
  conversationDate: new Date(),
  setConversationDate: () => undefined,
  conversationDateString: new Date().toISOString().split('T')[0],
  setConversationDateString: () => undefined,
  conversation: emptyConversation,
  setConversation: () => undefined,
  sendMessage: () => undefined,
  sortMessages: () => [],
  getMessages: () => undefined,
  getLastMessagesByLimit: () => undefined,
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
    scroll: boolean;
  }>({
    messages: [],
    checksum: '',
    scroll: false,
  });

  function sortMessages(messages: Message[]) {
    return messages.sort((a, b) => {
      const aTimestamp = Number(a.id.split('-')[0]);
      const bTimestamp = Number(b.id.split('-')[0]);
      return new Date(aTimestamp).getTime() - new Date(bTimestamp).getTime();
    });
  }

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

  const getLastMessagesByLimit = useCallback(
    (limit: number) => {
      if (!connection.socket || !connection.connected) {
        return;
      }

      connection.socket.emit('getLastMessagesByLimit', {
        limit,
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
        scroll: true,
      });
    });

    connection.socket.on('getLastMessagesByLimit', response => {
      setConversation({
        messages: response,
        checksum: sha256(JSON.stringify(response)),
        scroll: false,
      });
    });

    connection.socket.on('refreshMessages', () => {
      getMessages(conversationDateString, conversationDateString);
    });
  }, [connection.socket, conversationDateString, getMessages]);

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
        sortMessages,
        getMessages,
        getLastMessagesByLimit,
      }}>
      {children}
    </ChatContext.Provider>
  );
}
