import React, { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import BackgroundImage from '../../assets/svg/BackgroundImage';
import { mainColors } from '../../assets/colors/mainColors';
import { MMKV } from 'react-native-mmkv';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const backgroundDisabled =
  new MMKV().getString('background') === 'disabled' ? true : false;

const style = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    backgroundColor: mainColors.glass,
  },
  background: {
    position: 'absolute',
    top: -200,
    left: 0,
    height: windowHeight + 400,
    width: windowWidth + 620,
    backgroundColor: backgroundDisabled ? mainColors.background : 'transparent',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
});

export default function Background({ children }: { children: ReactNode }) {
  return (
    <View style={style.base}>
      <View style={style.background}>
        {!backgroundDisabled && <BackgroundImage />}
      </View>
      <View style={style.container}>{children}</View>
    </View>
  );
}
