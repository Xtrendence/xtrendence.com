import React, {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Message } from '../../../@types/Message';
import { Dispatch, SetStateAction, useMemo } from 'react';
import { messageToHtml, requiresHtmlConversion } from '../../../utils/utils';
import RenderHTML, { HTMLSource } from 'react-native-render-html';
import { mainColors } from '../../../assets/colors/mainColors';

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
    backgroundColor: mainColors.darkTransparent20,
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
    backgroundColor: mainColors.bubbleUser,
  },
  messageBubbleBot: {
    backgroundColor: mainColors.bubbleBot,
  },
  messageBubbleText: {
    margin: 0,
    color: mainColors.bubbleText,
    fontSize: 14,
    fontWeight: '300',
  },
});

export const messageHtmlStyle = {
  div: `
		color: ${mainColors.bubbleText};
		font-size: 14px;
		font-weight: 300;
	`,
  p: `
		margin: 0;
	`,
  a: `
		color: ${mainColors.bubbleText};
		text-decoration: underline;
	`,
};

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

  const memoResponseHtml: HTMLSource | null = useMemo(() => {
    if (!memoMessage?.response) {
      return null;
    }

    return { html: messageToHtml(memoMessage.response, messageHtmlStyle) };
  }, [memoMessage]);

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
              {requiresHtmlConversion(memoMessage?.response) ? (
                memoResponseHtml && (
                  <RenderHTML
                    contentWidth={windowWidth - 32 - 24}
                    source={memoResponseHtml}
                  />
                )
              ) : (
                <Text style={style.messageBubbleText}>
                  {memoMessage.response}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
