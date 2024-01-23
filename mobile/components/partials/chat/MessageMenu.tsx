import React, {
  BackHandler,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Message } from '../../../@types/Message';
import { Dispatch, SetStateAction, useEffect, useMemo } from 'react';
import { mainColors } from '../../../assets/colors/mainColors';
import Glass from '../../core/Glass';
import GlassOverlay from '../../core/GlassOverlay';
import Clipboard from '@react-native-clipboard/clipboard';
import { useChat } from '../../../hooks/useChat';
import RenderHTML, { HTMLSource } from 'react-native-render-html';
import { messageToHtml, requiresHtmlConversion } from '../../../utils/utils';
import { messageHtmlStyle } from './ChatRow';

const windowWidth = Dimensions.get('window').width;

const style = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    backgroundColor: mainColors.glass,
  },
  scrollView: {
    width: windowWidth - 32 - 16,
    height: '100%',
    marginLeft: 16,
  },
  scrollViewContainer: {
    paddingTop: 16,
    paddingRight: 16,
  },
  section: {
    marginBottom: 16,
    width: windowWidth - 64,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    color: mainColors.accentContrast,
    fontSize: 16,
    fontWeight: 'bold',
    margin: 8,
  },
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 8,
    width: windowWidth - 32 - 48,
    marginLeft: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'column',
    rowGap: 8,
  },
  containerRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 8,
    width: windowWidth - 32 - 48,
    marginLeft: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    rowGap: 8,
    columnGap: 8,
    flexWrap: 'wrap',
  },
  text: {
    color: mainColors.accentContrast,
    fontSize: 14,
  },
  button: {
    height: 40,
    padding: 8,
    borderRadius: 8,
  },
  buttonClose: {
    backgroundColor: mainColors.glass,
  },
  buttonCopy: {
    backgroundColor: mainColors.accent,
  },
  buttonDelete: {
    backgroundColor: mainColors.red,
  },
  buttonText: {
    color: mainColors.accentContrast,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default function MessageMenu({
  message,
  setShowMessageMenu,
}: {
  message: Message;
  setShowMessageMenu: Dispatch<SetStateAction<Message | undefined>>;
}) {
  const chat = useChat();

  useEffect(() => {
    const handleBack = () => {
      setShowMessageMenu(undefined);
      return true;
    };

    BackHandler.addEventListener('hardwareBackPress', handleBack);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBack);
    };
  }, [setShowMessageMenu]);

  const memoResponseHtml: HTMLSource | null = useMemo(() => {
    if (!message?.response) {
      return null;
    }

    return { html: messageToHtml(message.response, messageHtmlStyle) };
  }, [message.response]);

  const date = useMemo(() => {
    if (!message?.id) {
      return null;
    }

    const timestamp = Number(message.id.split('-')[0]);
    return new Date(timestamp).toLocaleString();
  }, [message]);

  return (
    <Glass wrapperStyle={style.wrapper}>
      <ScrollView
        style={style.scrollView}
        contentContainerStyle={style.scrollViewContainer}>
        <GlassOverlay wrapperStyle={style.section}>
          <Text style={style.header}>Message ID</Text>
          <View style={style.container}>
            <Text selectable style={style.text}>
              {message.id}
            </Text>
          </View>
        </GlassOverlay>
        <GlassOverlay wrapperStyle={style.section}>
          <Text style={style.header}>Date</Text>
          <View style={style.container}>
            <Text selectable style={style.text}>
              {date}
            </Text>
          </View>
        </GlassOverlay>
        {message.intent && (
          <GlassOverlay wrapperStyle={style.section}>
            <Text style={style.header}>Intent</Text>
            <View style={style.container}>
              <Text style={style.text}>Name: {message.intent.name}</Text>
              <Text style={style.text}>
                Description: {message.intent.description}
              </Text>
            </View>
          </GlassOverlay>
        )}
        {message.message && (
          <GlassOverlay wrapperStyle={style.section}>
            <Text style={style.header}>Message</Text>
            <View style={style.container}>
              <Text selectable style={style.text}>
                {message.message}
              </Text>
            </View>
          </GlassOverlay>
        )}
        {message.response && (
          <GlassOverlay wrapperStyle={style.section}>
            <Text style={style.header}>Response</Text>
            <View style={style.container}>
              <Text selectable style={style.text}>
                {message.response}
              </Text>
            </View>
          </GlassOverlay>
        )}
        {message.response &&
          requiresHtmlConversion(message.response) &&
          memoResponseHtml && (
            <GlassOverlay wrapperStyle={style.section}>
              <Text style={style.header}>Styled Response</Text>
              <View style={style.container}>
                <RenderHTML
                  contentWidth={windowWidth - 32 - 24}
                  source={memoResponseHtml}
                />
              </View>
            </GlassOverlay>
          )}
        {message.sanitizedMessage && (
          <GlassOverlay wrapperStyle={style.section}>
            <Text style={style.header}>Sanitized Message</Text>
            <View style={style.container}>
              <Text selectable style={style.text}>
                {message.sanitizedMessage}
              </Text>
            </View>
          </GlassOverlay>
        )}
        <GlassOverlay wrapperStyle={style.section}>
          <Text style={style.header}>Actions</Text>
          <View style={style.containerRow}>
            <TouchableOpacity
              style={[style.button, style.buttonClose]}
              onPress={() => {
                setShowMessageMenu(undefined);
              }}>
              <Text selectable style={style.buttonText}>
                Close
              </Text>
            </TouchableOpacity>
            {message.message && (
              <TouchableOpacity
                style={[style.button, style.buttonCopy]}
                onPress={() => {
                  Clipboard.setString(message.message || '');
                }}>
                <Text selectable style={style.buttonText}>
                  Copy Message
                </Text>
              </TouchableOpacity>
            )}
            {message.response && (
              <TouchableOpacity
                style={[style.button, style.buttonCopy]}
                onPress={() => {
                  Clipboard.setString(message.response || '');
                }}>
                <Text selectable style={style.buttonText}>
                  Copy Response
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[style.button, style.buttonDelete]}
              onPress={() => {
                chat.deleteMessage(message.id);
                setShowMessageMenu(undefined);
              }}>
              <Text selectable style={style.buttonText}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </GlassOverlay>
      </ScrollView>
    </Glass>
  );
}
