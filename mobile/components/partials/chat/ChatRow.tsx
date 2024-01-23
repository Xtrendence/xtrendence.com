import React, {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Message } from '../../../@types/Message';
import { Dispatch, SetStateAction, useMemo } from 'react';

const windowWidth = Dimensions.get('window').width;

const style = StyleSheet.create({
  row: {
    display: 'flex',
    paddingTop: 12,
  },
  rowFirst: {
    paddingBottom: 12,
  },
  message: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginRight: 12,
    marginLeft: 12,
    width: windowWidth - 32 - 24,
  },
  messageLast: {
    marginBottom: 10,
  },
  messageBreak: {
    display: 'flex',
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
  },
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowBot: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 8,
    margin: 4,
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  messageBubbleBot: {
    backgroundColor: 'rgba(160, 112, 175, 0.5)',
  },
  messageBubbleText: {
    margin: 0,
    color: 'rgb(255, 255, 255)',
  },
});

export default function ChatRow({
  message,
  index,
  setShowMessageMenu,
}: {
  message: Message;
  index: number;
  setShowMessageMenu: Dispatch<SetStateAction<Message | undefined>>;
}) {
  const memoMessage = useMemo(() => message, [message]);
  const memoIndex = useMemo(() => index, [index]);
  const memoSetShowMessageMenu = useMemo(
    () => setShowMessageMenu,
    [setShowMessageMenu],
  );

  return (
    <TouchableOpacity
      onPress={() => memoSetShowMessageMenu(memoMessage)}
      style={[style.row, memoIndex === 0 ? style.rowFirst : null]}>
      <View style={style.message}>
        {memoMessage?.message && (
          <View style={[style.messageRow, style.messageRowUser]}>
            <View style={[style.messageBubble, style.messageBubbleUser]}>
              <Text style={style.messageBubbleText}>{memoMessage.message}</Text>
            </View>
          </View>
        )}
        {memoMessage?.response && (
          <View style={[style.messageRow, style.messageRowBot]}>
            <View style={[style.messageBubble, style.messageBubbleBot]}>
              <Text style={style.messageBubbleText}>
                {memoMessage.response}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
