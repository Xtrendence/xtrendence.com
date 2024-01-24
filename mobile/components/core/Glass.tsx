import { BlurView } from '@react-native-community/blur';
import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { mainColors } from '../../assets/colors/mainColors';

const style = (props?: { borderRadius?: number }) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: props?.borderRadius,
      overflow: props?.borderRadius ? 'hidden' : 'visible',
      borderColor: mainColors.accentContrastMoreTransparent,
      borderWidth: 1,
      borderStyle: 'solid',
      position: 'relative',
    },
    container: {
      backgroundColor: mainColors.glassLessTransparent,
      height: '100%',
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
    },
  });

export default function Glass({
  wrapperStyle,
  children,
}: {
  wrapperStyle?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <View style={wrapperStyle || style({ borderRadius: 8 }).wrapper}>
      <BlurView
        overlayColor="transparent"
        style={style().container}
        blurAmount={8}
        blurRadius={6}
      />
      {children}
    </View>
  );
}
