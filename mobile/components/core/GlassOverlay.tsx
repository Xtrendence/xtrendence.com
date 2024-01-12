import { BlurView } from '@react-native-community/blur';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { mainColors } from '../../assets/colors/mainColors';

const style = (props?: { borderRadius?: number }) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: props?.borderRadius,
      overflow: props?.borderRadius ? 'hidden' : 'visible',
      borderColor: 'rgba(255, 255, 255, 0.125)',
      borderWidth: 1,
      borderStyle: 'solid',
    },
    container: {
      backgroundColor: mainColors.glassOverlay,
    },
  });

export default function GlassOverlay({ children }: { children: ReactNode }) {
  return (
    <View style={style({ borderRadius: 8 }).wrapper}>
      <BlurView
        overlayColor="transparent"
        style={style().container}
        blurAmount={4}
        blurRadius={4}>
        {children}
      </BlurView>
    </View>
  );
}
