import React, {
  Dimensions,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { mainColors } from '../../../assets/colors/mainColors';
import { useState } from 'react';
import { useChat } from '../../../hooks/useChat';
import SendIcon from '../../../assets/svg/SendIcon';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';

const windowWidth = Dimensions.get('window').width;

const style = (props?: { isKeyboardVisible?: boolean }) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      height: 64,
      backgroundColor: mainColors.glass,
      borderRadius: 8,
      borderBottomLeftRadius: props?.isKeyboardVisible ? 0 : 8,
      borderBottomRightRadius: props?.isKeyboardVisible ? 0 : 8,
      marginTop: 16,
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
      height: 40,
      width: props?.isKeyboardVisible ? windowWidth - 76 : windowWidth - 110,
    },
    sendButton: {
      height: 40,
      width: 40,
      padding: 10,
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

export default function ChatInput() {
  const { isKeyboardVisible } = useKeyboardVisible();

  const [message, setMessage] = useState('');
  const chat = useChat();

  return (
    <View style={style({ isKeyboardVisible }).wrapper}>
      <TextInput
        placeholder="Say Something..."
        value={message}
        onChangeText={(value: string) => setMessage(value)}
        cursorColor={mainColors.accent}
        style={style({ isKeyboardVisible }).input}
        placeholderTextColor={mainColors.accentContrast}
      />
      <TouchableOpacity
        style={style().sendButton}
        onPress={() => {
          chat.sendMessage(message);
        }}>
        <SendIcon fill={mainColors.accentContrast} style={style().sendIcon} />
      </TouchableOpacity>
    </View>
  );
}
