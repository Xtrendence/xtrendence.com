import React, { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Message } from '../../../@types/Message';

const windowWidth = Dimensions.get('window').width;

const style = StyleSheet.create({
  message: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginTop: 16,
    marginRight: 16,
    marginBottom: 0,
    marginLeft: 16,
    width: windowWidth - 32 - 32,
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

export default function ChatRow({ message }: { message: Message }) {
  return (
    <View style={style.message}>
      {message?.message && (
        <View style={[style.messageRow, style.messageRowUser]}>
          <View style={[style.messageBubble, style.messageBubbleUser]}>
            <Text style={style.messageBubbleText}>{message.message}</Text>
          </View>
        </View>
      )}
      {message?.response && (
        <View style={[style.messageRow, style.messageRowBot]}>
          <View style={[style.messageBubble, style.messageBubbleBot]}>
            <Text style={style.messageBubbleText}>{message.response}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
