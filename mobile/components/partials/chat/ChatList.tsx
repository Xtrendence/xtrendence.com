/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useChat } from '../../../hooks/useChat';
import ChatRow from './ChatRow';
import { useEffect, useRef, useState } from 'react';
import Glass from '../../core/Glass';
import { mainColors, rgbToHex } from '../../../assets/colors/mainColors';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const statusBarHeight = StatusBar?.currentHeight ? StatusBar.currentHeight : 0;

const listHeight =
  windowHeight -
  32 -
  64 -
  (statusBarHeight
    ? statusBarHeight > 64
      ? statusBarHeight - 48
      : statusBarHeight + 16
    : 32) -
  64 -
  16;

const keyboardOffset = statusBarHeight > 64 ? 34 : 48;

const style = (props?: {
  isKeyboardVisible?: boolean;
  keyboardHeight?: number;
}) =>
  StyleSheet.create({
    list: {
      minHeight:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
      maxHeight:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
    },
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: props?.isKeyboardVisible ? windowWidth - 32 : '100%',
      marginLeft: props?.isKeyboardVisible ? 16 : 0,
      height:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
      minHeight:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
      maxHeight:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
      borderRadius: 8,
      overflow: 'scroll',
    },
    container: {
      display: 'flex',
    },
  });

export default function ChatList({
  refreshing,
  refresh,
  lastRefresh,
}: {
  refreshing: boolean;
  refresh: () => void;
  lastRefresh: Date;
}) {
  const chat = useChat();
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const chatRef = useRef<FlatList>(null);

  const [limit, setLimit] = useState<number>(10);
  const [scroll, setScroll] = useState<boolean>(true);

  useEffect(() => {
    chat.getLastMessagesByLimit(limit);
  }, [chat.getLastMessagesByLimit, limit]);

  useEffect(() => {
    setScroll(true);
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (chat.conversation.scroll || scroll) {
      setTimeout(() => {
        chatRef?.current?.scrollToEnd({ animated: true });
        setScroll(false);
      }, 100);
    }
  }, [isKeyboardVisible, chat.conversation.checksum, lastRefresh, scroll]);

  return (
    <Glass wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
      <FlatList
        onStartReached={() => {
          setLimit(limit + 10);
        }}
        refreshControl={
          refreshing ? (
            <RefreshControl
              onRefresh={() => {
                refresh();
              }}
              refreshing={refreshing}
              progressBackgroundColor={mainColors.accentTransparent}
              colors={[rgbToHex(mainColors.accentContrast)]}
            />
          ) : undefined
        }
        ref={chatRef}
        style={style({ isKeyboardVisible, keyboardHeight }).list}
        data={chat.sortMessages(chat.conversation.messages)}
        keyExtractor={item => item.id}
        contentContainerStyle={style().container}
        maxToRenderPerBatch={10}
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
