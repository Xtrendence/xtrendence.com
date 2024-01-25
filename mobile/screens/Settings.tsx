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
import {
  MainColor,
  MainColors,
  colorsAreValid,
  mainColors,
} from '../assets/colors/mainColors';
import { useEffect, useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { useAuth } from '../hooks/useAuth';
import SettingsColorPicker from '../components/partials/SettingsColorPicker';
import { useStorage } from '../hooks/useStorage';
import RNRestart from 'react-native-restart';

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
    scrollView: {
      marginLeft: 16,
      paddingRight: 16,
    },
    scrollViewContainer: {
      paddingBottom: 16,
    },
    container: {
      marginTop: 16,
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
    row: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingLeft: 16,
      paddingRight: 8,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: 8,
      backgroundColor: mainColors.darkTransparent20,
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
    subtitle: {
      color: mainColors.accentContrast,
      fontSize: 14,
      marginTop: -2,
    },
    swatchWrapper: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 4,
      borderRadius: 8,
      backgroundColor: 'rgb(255, 255, 255)',
    },
    swatch: {
      width: 24,
      height: 24,
      borderRadius: 6,
    },
  });

export default function Settings() {
  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const { storage } = useStorage();

  const backgroundDisabled =
    storage?.getString('background') === 'disabled' ? true : false;

  const { logout } = useAuth();
  const { apiUrl, setApiUrl } = useAPI();

  const [url, setUrl] = useState(apiUrl);

  const [colors, setColors] = useState<MainColors>(mainColors);

  const [colorPicker, setColorPicker] = useState<{
    color: MainColor;
    value: string;
    visible: boolean;
    save: boolean;
  }>();

  useEffect(() => {
    if (colorPicker && colorPicker?.save) {
      setColors({
        ...colors,
        [colorPicker.color]: colorPicker?.value,
      });

      setColorPicker(undefined);
    }
  }, [colorPicker, colors]);

  if (colorPicker?.visible) {
    return <SettingsColorPicker picker={{ colorPicker, setColorPicker }} />;
  }

  return (
    <Header
      title="Settings"
      backPage="conversation"
      bodyStyle={bodyStyle(isKeyboardVisible)}>
      <Glass
        wrapperStyle={style({ isKeyboardVisible, keyboardHeight }).wrapper}>
        <ScrollView
          style={style().scrollView}
          contentContainerStyle={style().scrollViewContainer}>
          <View style={style({ isKeyboardVisible, keyboardHeight }).container}>
            <TextInput
              selectionColor={mainColors.accent}
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
          <View style={style({ isKeyboardVisible, keyboardHeight }).container}>
            <View style={style().row}>
              <Text style={style().subtitle}>Background</Text>
              <TouchableOpacity
                onPress={() => {
                  if (backgroundDisabled) {
                    storage?.delete('background');
                    RNRestart.restart();
                  } else {
                    storage?.set('background', 'disabled');
                    RNRestart.restart();
                  }
                }}
                style={[
                  style().button,
                  {
                    backgroundColor: backgroundDisabled
                      ? mainColors.accentDark
                      : mainColors.accent,
                  },
                ]}>
                <Text style={style().buttonText}>
                  {backgroundDisabled ? 'Disabled' : 'Enabled'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={style().row}>
              <Text style={style().subtitle}>Save Colors</Text>
              <TouchableOpacity
                onPress={() => {
                  const json = JSON.stringify(colors);
                  if (colorsAreValid(json)) {
                    storage?.set('colors', json);
                    RNRestart.restart();
                  }
                }}
                style={style().button}>
                <Text style={style().buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
            {Object.keys(colors).map((color: string) => {
              const currentColor = color as MainColor;

              return (
                <TouchableOpacity
                  onPress={() => {
                    setColorPicker({
                      color: currentColor,
                      value: colors[currentColor],
                      visible: true,
                      save: false,
                    });
                  }}
                  style={style().row}
                  key={color}>
                  <Text style={style().subtitle}>{color}</Text>
                  <View style={style().swatchWrapper}>
                    <View
                      style={[
                        style().swatch,
                        {
                          backgroundColor: colors[currentColor],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={style().row}>
              <Text style={style().subtitle}>Reset Colors</Text>
              <TouchableOpacity
                onPress={() => {
                  storage?.delete('colors');
                  RNRestart.restart();
                }}
                style={[style().button, { backgroundColor: mainColors.red }]}>
                <Text style={style().buttonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Glass>
    </Header>
  );
}
