import React, {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mainColors } from '../../assets/colors/mainColors';
import { useEffect } from 'react';

const style = StyleSheet.create({
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: mainColors.glass,
  },
  text: {
    color: mainColors.accentContrast,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
});

export default function LoadingScreen({ text }: { text?: string }) {
  StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');

  useEffect(() => {
    return () => {
      setTimeout(() => {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor(mainColors.glass);
      }, 1000);
    };
  }, []);

  return (
    <View style={style.wrapper}>
      <ActivityIndicator size={64} color={mainColors.accentContrast} />
      <Text style={style.text}>{text || 'Loading...'}</Text>
    </View>
  );
}
