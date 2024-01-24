import React, {
  Dimensions,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { mainColors } from '../../../assets/colors/mainColors';
import { RefObject, useCallback, useEffect, useState } from 'react';
import { useChat } from '../../../hooks/useChat';
import SendIcon from '../../../assets/svg/SendIcon';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import Glass from '../../core/Glass';

const windowWidth = Dimensions.get('window').width;

const style = (props?: {
  isKeyboardVisible?: boolean;
  keyboardHeight?: number;
}) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      width: '100%',
      minHeight: 64,
      height:
        props?.isKeyboardVisible && props?.keyboardHeight
          ? props.keyboardHeight + 128
          : 64,
      borderRadius: 8,
      borderBottomLeftRadius: props?.isKeyboardVisible ? 0 : 8,
      borderBottomRightRadius: props?.isKeyboardVisible ? 0 : 8,
      marginTop: 16,
      overflow: 'hidden',
    },
    input: {
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      color: mainColors.accentContrast,
      padding: 0,
      paddingLeft: 12,
      paddingRight: 12,
      marginLeft: 12,
      marginRight: 12,
      marginTop: 12,
      height: 40,
      width: props?.isKeyboardVisible ? windowWidth - 76 : windowWidth - 110,
    },
    sendButton: {
      height: 40,
      width: 40,
      padding: 10,
      marginTop: 12,
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendIcon: {
      width: 24,
      height: 24,
    },
  });

export default function ChatInput({
  inputRef,
}: {
  inputRef: RefObject<TextInput>;
}) {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const [message, setMessage] = useState('');
  const chat = useChat();

  useEffect(() => {
    if (!isKeyboardVisible) {
      inputRef?.current?.blur();
    }
  }, [inputRef, isKeyboardVisible]);

  const handleSend = useCallback(
    (input: string) => {
      if (!input) {
        return;
      }

      chat.sendMessage(input);
      setMessage('');
    },
    [chat],
  );

  return (
    <Glass wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
      <TextInput
        ref={inputRef}
        placeholder="Say Something..."
        value={message}
        onChangeText={(value: string) => setMessage(value)}
        cursorColor={mainColors.accent}
        style={style({ isKeyboardVisible }).input}
        placeholderTextColor={mainColors.accentContrast}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={() => {
          handleSend(message);
        }}
      />
      <TouchableOpacity
        style={style().sendButton}
        onPress={() => {
          if (inputRef?.current?.isFocused() && !isKeyboardVisible) {
            inputRef?.current?.blur();
          }

          inputRef?.current?.focus();
          handleSend(message);
        }}>
        <SendIcon fill={mainColors.accentContrast} style={style().sendIcon} />
      </TouchableOpacity>
    </Glass>
  );
}
