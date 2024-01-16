/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useChat } from '../../../hooks/useChat';
import ChatRow from './ChatRow';
import { useEffect, useRef } from 'react';
import Glass from '../../core/Glass';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const listHeight =
  windowHeight -
  32 -
  64 -
  (StatusBar?.currentHeight ? StatusBar.currentHeight + 16 : 32) -
  64 -
  16;

const style = (props?: {
  isKeyboardVisible?: boolean;
  keyboardHeight?: number;
}) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: props?.isKeyboardVisible ? windowWidth - 32 : '100%',
      marginLeft: props?.isKeyboardVisible ? 16 : 0,
      height:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + 48
          : listHeight,
      borderRadius: 8,
      overflow: 'scroll',
    },
    container: {
      display: 'flex',
    },
  });

export default function ChatList() {
  const chat = useChat();
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const chatRef = useRef<FlatList>(null);

  useEffect(() => {
    chat.getMessages(chat.conversationDateString, chat.conversationDateString);
  }, [chat.getMessages]);

  useEffect(() => {
    setTimeout(() => {
      chatRef?.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [isKeyboardVisible, chat.conversation]);

  return (
    <Glass wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
      <FlatList
        ref={chatRef}
        data={chat.conversation.messages}
        keyExtractor={item => item.id}
        contentContainerStyle={style().container}
        renderItem={item => {
          const message = item.item;
          return (
            <ChatRow key={message.id} message={message} index={item.index} />
          );
        }}
      />
    </Glass>
  );
}
