import React, {
  Dimensions,
  StatusBar,
  TextInput,
  ViewStyle,
} from 'react-native';
import Header from '../../core/Header';
import ChatInput from './ChatInput';
import ChatList from './ChatList';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useSocket } from '../../../hooks/useSocket';
import LoadingScreen from '../../core/LoadingScreen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '../../../hooks/useChat';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const statusBarHeight = StatusBar?.currentHeight ? StatusBar.currentHeight : 0;

const bodyHeight =
  statusBarHeight > 64
    ? windowHeight - statusBarHeight - 48
    : windowHeight - statusBarHeight + 16;

const bodyStyle = (isKeyboardVisible?: boolean): ViewStyle => ({
  display: 'flex',
  position: 'relative',
  width: isKeyboardVisible ? windowWidth : windowWidth - 32,
  height: bodyHeight,
  borderRadius: 8,
  overflow: 'hidden',
  marginTop: 16,
});

export default function Chat() {
  const connection = useSocket();
  const { isKeyboardVisible } = useKeyboardVisible();

  const chat = useChat();

  const inputRef = useRef<TextInput>(null);

  const [showMore, setShowMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (showMore) {
      inputRef?.current?.blur();
    }
  }, [showMore]);

  const refresh = useCallback(() => {
    setRefreshing(true);

    chat.getLastMessagesByLimit(chat.conversation.messages.length || 10);

    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, [chat]);

  if (!connection.socket || !connection.connected) {
    return <LoadingScreen />;
  }

  return (
    <Header
      title="Riley"
      bodyStyle={bodyStyle(isKeyboardVisible)}
      showMore={showMore}
      setShowMore={setShowMore}
      menuItems={[
        {
          text: 'Refresh Chat',
          onPress: () => {
            refresh();
          },
        },
      ]}>
      <ChatList
        initialLimit={20}
        refresh={refresh}
        refreshing={refreshing}
        inputRef={inputRef}
      />
      <ChatInput inputRef={inputRef} />
    </Header>
  );
}
