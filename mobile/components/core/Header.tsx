import React, {
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import MoreIcon from '../../assets/svg/MoreIcon';
import HelpIcon from '../../assets/svg/HelpIcon';
import SettingsIcon from '../../assets/svg/SettingsIcon';
import { mainColors } from '../../assets/colors/mainColors';
import { ReactNode, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { usePage } from '../../hooks/usePage';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const bodyHeight =
  windowHeight -
  32 -
  64 -
  (StatusBar?.currentHeight ? StatusBar.currentHeight + 16 : 32);

const style = (props?: { isKeyboardVisible?: boolean }) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: props?.isKeyboardVisible ? windowWidth : windowWidth - 32,
      height: '100%',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: props?.isKeyboardVisible
        ? StatusBar?.currentHeight
        : StatusBar?.currentHeight
        ? StatusBar.currentHeight + 16
        : 32,
    },
    header: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: props?.isKeyboardVisible ? windowWidth : windowWidth - 32,
      height: props?.isKeyboardVisible ? 48 : 64,
      paddingLeft: 20,
      paddingRight: 10,
      backgroundColor: mainColors.glass,
      borderRadius: 8,
      borderTopLeftRadius: props?.isKeyboardVisible ? 0 : 8,
      borderTopRightRadius: props?.isKeyboardVisible ? 0 : 8,
    },
    title: {
      color: mainColors.accentContrast,
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: -2,
    },
    iconsWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 10,
    },
    iconWrapper: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: props?.isKeyboardVisible ? 32 : 48,
      height: props?.isKeyboardVisible ? 32 : 48,
      borderRadius: 8,
      backgroundColor: mainColors.glassOverlay,
    },
    icon: {
      width: props?.isKeyboardVisible ? 24 : 32,
      height: props?.isKeyboardVisible ? 24 : 32,
    },
    body: {
      display: 'flex',
      width: windowWidth - 32,
      height: props?.isKeyboardVisible ? bodyHeight + 48 : bodyHeight,
      backgroundColor: mainColors.glass,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 16,
    },
  });

export default function Header({
  title,
  bodyStyle,
  children,
}: {
  title: string;
  bodyStyle?: ViewStyle;
  children?: ReactNode;
}) {
  const { isKeyboardVisible } = useKeyboardVisible();

  const { sendMessage } = useChat();
  const { setPage } = usePage();
  const [showMore, setShowMore] = useState(false);

  return (
    <View style={style({ isKeyboardVisible }).wrapper}>
      <View style={style({ isKeyboardVisible }).header}>
        <View>
          <Text style={style().title}>{title}</Text>
        </View>
        <View style={style().iconsWrapper}>
          <TouchableOpacity
            style={style({ isKeyboardVisible }).iconWrapper}
            onPress={() => {
              setShowMore(!showMore);
            }}>
            <MoreIcon
              fill={mainColors.accentContrast}
              style={style({ isKeyboardVisible }).icon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={style({ isKeyboardVisible }).iconWrapper}
            onPress={() => {
              sendMessage('/help');
            }}>
            <HelpIcon
              fill={mainColors.accentContrast}
              style={style({ isKeyboardVisible }).icon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={style({ isKeyboardVisible }).iconWrapper}
            onPress={() => {
              setPage('settings');
            }}>
            <SettingsIcon
              fill={mainColors.accentContrast}
              style={style({ isKeyboardVisible }).icon}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={bodyStyle ? bodyStyle : style().body}>{children}</View>
    </View>
  );
}
