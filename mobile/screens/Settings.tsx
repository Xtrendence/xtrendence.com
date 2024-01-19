import React, {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Header from '../components/core/Header';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import Glass from '../components/core/Glass';
import { mainColors } from '../assets/colors/mainColors';
import { useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { useAuth } from '../hooks/useAuth';

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

const listHeight =
  windowHeight -
  16 -
  (statusBarHeight
    ? statusBarHeight > 64
      ? statusBarHeight - 48
      : statusBarHeight + 16
    : 32) -
  64 -
  16;

const keyboardOffset = statusBarHeight > 64 ? 18 : 32;

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
          ? listHeight - props?.keyboardHeight + keyboardOffset
          : listHeight,
      borderRadius: 8,
      overflow: 'scroll',
    },
    container: {
      marginTop: 16,
      marginLeft: 16,
      padding: 16,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      width: windowWidth - 32 - 32,
      flexDirection: 'column',
      rowGap: 10,
      borderRadius: 8,
      backgroundColor: mainColors.glassOverlay,
    },
    containerRow: {
      marginTop: 16,
      marginLeft: 16,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: windowWidth - 32 - 32,
      flexDirection: 'row',
      rowGap: 10,
      borderRadius: 8,
      backgroundColor: mainColors.glassOverlay,
    },
    input: {
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      color: mainColors.accentContrast,
      padding: 0,
      paddingLeft: 12,
      paddingRight: 12,
      height: 40,
      width: '100%',
    },
    button: {
      backgroundColor: mainColors.accent,
      color: mainColors.accentContrast,
      borderRadius: 8,
      padding: 8,
      paddingRight: 16,
      paddingLeft: 16,
      width: 'auto',
    },
    buttonText: {
      color: mainColors.accentContrast,
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: 16,
    },
    title: {
      color: mainColors.accentContrast,
      fontSize: 20,
      fontWeight: 'bold',
    },
  });

export default function Settings() {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const { logout } = useAuth();
  const { apiUrl, setApiUrl } = useAPI();

  const [url, setUrl] = useState(apiUrl);

  return (
    <Header
      title="Settings"
      backPage="conversation"
      bodyStyle={bodyStyle(isKeyboardVisible)}>
      <Glass
        wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
        <ScrollView>
          <View style={style({ isKeyboardVisible, keyboardHeight }).container}>
            <TextInput
              placeholder="API URL..."
              value={url}
              onEndEditing={() => setUrl(url)}
              onChangeText={(value: string) => setUrl(value)}
              cursorColor={mainColors.accent}
              style={style().input}
              placeholderTextColor={mainColors.accentContrast}
            />
            <TouchableOpacity
              onPress={() => setApiUrl(url)}
              style={style().button}>
              <Text style={style().buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
          <View
            style={style({ isKeyboardVisible, keyboardHeight }).containerRow}>
            <Text style={style().title}>Account</Text>
            <TouchableOpacity onPress={() => logout()} style={style().button}>
              <Text style={style().buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Glass>
    </Header>
  );
}
