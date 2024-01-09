import { useEffect, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';

export const useKeyboardVisible = () => {
  const windowHeight = Dimensions.get('window').height;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e: any) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e?.endCoordinates?.height);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, [windowHeight]);

  return {
    isKeyboardVisible,
    keyboardHeight,
  };
};
