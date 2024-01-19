import React, {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { mainColors } from '../../assets/colors/mainColors';
import { useEffect, useState } from 'react';
import { usePage } from '../../hooks/usePage';

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
  button: {
    backgroundColor: mainColors.accent,
    color: mainColors.accentContrast,
    borderRadius: 8,
    padding: 8,
    marginTop: 16,
    width: 200,
  },
  buttonText: {
    color: mainColors.accentContrast,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function LoadingScreen({ text }: { text?: string }) {
  const { setPage, page } = usePage();

  const [showButton, setShowButton] = useState(false);

  StatusBar.setTranslucent(true);
  StatusBar.setBackgroundColor('transparent');

  useEffect(() => {
    setTimeout(() => {
      setShowButton(true);
    }, 2500);

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
      {page !== 'login' && showButton && (
        <View>
          {page !== 'conversation' && (
            <TouchableOpacity
              onPress={() => setPage('conversation')}
              style={style.button}>
              <Text style={style.buttonText}>Conversation</Text>
            </TouchableOpacity>
          )}
          {page !== 'settings' && (
            <TouchableOpacity
              onPress={() => setPage('settings')}
              style={style.button}>
              <Text style={style.buttonText}>Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
