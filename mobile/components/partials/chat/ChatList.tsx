import React, { Dimensions, StatusBar, StyleSheet, View } from 'react-native';
import { mainColors } from '../../../assets/colors/mainColors';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useChat } from '../../../hooks/useChat';
import ChatRow from './ChatRow';
import { useEffect } from 'react';

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
      backgroundColor: mainColors.glass,
      borderRadius: 8,
    },
  });

export default function ChatList() {
  const chat = useChat();
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  useEffect(() => {
    chat.getMessages(chat.conversationDateString, chat.conversationDateString);
  }, [chat]);

  return (
    <View style={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
      {chat.conversation.messages.map(message => (
        <ChatRow key={message.id} message={message} />
      ))}
    </View>
  );
}
