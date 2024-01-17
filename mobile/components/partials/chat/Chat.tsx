import React, { Dimensions, StatusBar, ViewStyle } from 'react-native';
import Header from '../../core/Header';
import ChatInput from './ChatInput';
import ChatList from './ChatList';
import { useKeyboardVisible } from '../../../hooks/useKeyboardVisible';
import { useSocket } from '../../../hooks/useSocket';
import LoadingScreen from '../../core/LoadingScreen';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const statusBarHeight = StatusBar?.currentHeight ? StatusBar.currentHeight : 0;

const bodyHeight =
  statusBarHeight > 64
    ? windowHeight - statusBarHeight - 48
    : windowHeight - statusBarHeight + 16;

const bodyStyle = (isKeyboardVisible?: boolean): ViewStyle => ({
  display: 'flex',
  position: 'relative',
  width: isKeyboardVisible ? windowWidth : windowWidth - 32,
  height: bodyHeight,
  borderRadius: 8,
  overflow: 'hidden',
  marginTop: 16,
});

export default function Chat() {
  const connection = useSocket();
  const { isKeyboardVisible } = useKeyboardVisible();

  if (!connection.socket || !connection.connected) {
    return <LoadingScreen />;
  }

  return (
    <Header title="Riley" bodyStyle={bodyStyle(isKeyboardVisible)}>
      <ChatList />
      <ChatInput />
    </Header>
  );
}
