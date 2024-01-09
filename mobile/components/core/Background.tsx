import React, { ReactNode } from 'react';
import { Dimensions, StatusBar, StyleSheet, View } from 'react-native';
import BackgroundImage from '../../assets/svg/BackgroundImage';
import { mainColors } from '../../assets/colors/mainColors';

StatusBar.setTranslucent(true);
StatusBar.setBackgroundColor(mainColors.glass);

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const style = StyleSheet.create({
  background: {
    position: 'absolute',
    top: -200,
    left: 0,
    height: windowHeight + 200,
    width: windowWidth + 320,
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
    <View>
      <View style={style.background}>
        <BackgroundImage />
      </View>
      <View style={style.container}>{children}</View>
    </View>
  );
}
