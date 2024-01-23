/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useChat } from '../../../hooks/useChat';
import ChatRow from './ChatRow';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import Glass from '../../core/Glass';
import { mainColors, rgbToHex } from '../../../assets/colors/mainColors';
import { Message } from '../../../@types/Message';
import MessageMenu from './MessageMenu';

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
      minHeight: 0,
      maxHeight:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
    },
    container: {
      display: 'flex',
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    wrapper: {
      position: 'relative',
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
    loadingWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1,
      backgroundColor: 'rgb(17, 25, 40)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: 'rgb(255, 255, 255)',
      fontSize: 16,
      fontWeight: 'bold',
    },
    messageMenu: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1,
    },
  });

export default function ChatList({
  initialLimit = 10,
  refreshing,
  refresh,
  inputRef,
}: {
  initialLimit?: number;
  refreshing: boolean;
  refresh: () => void;
  inputRef: RefObject<TextInput>;
}) {
  const chat = useChat();
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const chatRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showMessageMenu, setShowMessageMenu] = useState<Message | undefined>();

  const [state, setState] = useState<{
    limit: number;
    limitLocked: boolean;
  }>({
    limit: initialLimit,
    limitLocked: true,
  });

  useEffect(() => {
    if (showMessageMenu) {
      inputRef?.current?.blur();
    }
  }, [showMessageMenu]);

  useEffect(() => {
    if (
      chatRef?.current &&
      initialLoad &&
      (state.limit === initialLimit || state.limit < initialLimit) &&
      chat.conversation.messages?.length > 0 &&
      !loading
    ) {
      setTimeout(() => {
        chatRef.current?.scrollToOffset({ offset: 0, animated: true });
        setInitialLoad(false);
      }, 150);
    }
  }, [chatRef, initialLoad, chat.conversation.messages, state.limit, loading]);

  useEffect(() => {
    if (isKeyboardVisible) {
      setTimeout(() => {
        setShowMessageMenu(undefined);
        chatRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [isKeyboardVisible, chatRef]);

  useEffect(() => {
    if (state.limit <= 0) {
      setState({ ...state, limit: initialLimit });
      return;
    }

    if (
      chat.conversation.total > 0 &&
      state.limit > chat.conversation.total &&
      chat.conversation.total >= initialLimit
    ) {
      setState({ ...state, limit: chat.conversation.total });
      return;
    }

    if (initialLoad) {
      setLoading(true);

      setTimeout(() => {
        setLoading(false);
      }, 500);
    }

    chat.getLastMessagesByLimit(state.limit);
  }, [
    chat.getLastMessagesByLimit,
    initialLoad,
    state.limit,
    chat.conversation.total,
    chat.conversation.messages?.length,
  ]);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const message = item;

      return (
        <ChatRow
          key={message.id}
          message={message}
          index={index}
          setShowMessageMenu={setShowMessageMenu}
        />
      );
    },
    [chat.conversation.messages, setShowMessageMenu],
  );

  return (
    <Glass wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
      {showMessageMenu && (
        <View style={style().messageMenu}>
          <MessageMenu
            message={showMessageMenu}
            setShowMessageMenu={setShowMessageMenu}
          />
        </View>
      )}
      {loading && (
        <View style={style().loadingWrapper}>
          <Text style={style().loadingText}>Fetching Messages...</Text>
        </View>
      )}
      <FlatList
        onEndReached={() => {
          if (state.limitLocked || state.limit === chat.conversation.total) {
            return;
          }

          const newLimit = chat.conversation.messages?.length + initialLimit;

          setState({
            limit: newLimit,
            limitLocked: true,
          });
        }}
        onScrollToIndexFailed={() => {}}
        onScroll={() => {
          if (state.limitLocked) {
            setState({ ...state, limitLocked: false });
          }
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
              progressViewOffset={
                windowHeight -
                (statusBarHeight > 64
                  ? statusBarHeight + windowHeight / 2 - 256 + 24
                  : statusBarHeight + windowHeight / 2 - 128 + 24)
              }
            />
          ) : undefined
        }
        ref={chatRef}
        style={style({ isKeyboardVisible, keyboardHeight }).list}
        data={chat.sortMessages(chat.conversation.messages).reverse()}
        keyExtractor={item => item.id}
        contentContainerStyle={style().container}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        renderItem={renderItem}
        inverted
      />
    </Glass>
  );
}
