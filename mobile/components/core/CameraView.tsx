import { Dispatch, useState } from 'react';
import React, { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { mainColors } from '../../assets/colors/mainColors';
import Glass from './Glass';
import { validJSON } from '../../utils/utils';

const style = StyleSheet.create({
  wrapper: {
    display: 'flex',
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    height: '100%',
    width: '100%',
  },
  buttonWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: mainColors.glass,
  },
  button: {
    backgroundColor: mainColors.accent,
    padding: 10,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  buttonText: {
    color: mainColors.accentContrast,
  },
});

export default function CameraView({
  setCameraVisible,
  setScanned,
}: {
  setCameraVisible: Dispatch<boolean>;
  setScanned: Dispatch<Array<string | undefined>>;
}) {
  const device = useCameraDevice('back');

  const [isActive, setIsActive] = useState(true);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: codes => {
      setIsActive(false);

      setTimeout(() => {
        const strings = codes?.map(code => {
          if (code?.value && code.value !== null && code.value?.length > 0) {
            if (validJSON(code.value)) {
              return code.value;
            }
          }
        });

        setScanned(strings);
      }, 250);
    },
  });

  if (!device) {
    return (
      <View style={style.wrapper}>
        <Text>No Device Found</Text>
      </View>
    );
  }

  return (
    <View style={style.wrapper}>
      <Camera
        style={style.camera}
        codeScanner={codeScanner}
        device={device}
        isActive={isActive}
      />
      <Glass wrapperStyle={style.buttonWrapper}>
        <View>
          <TouchableOpacity
            style={style.button}
            onPress={() => setCameraVisible(false)}>
            <Text style={style.buttonText}>Close Camera</Text>
          </TouchableOpacity>
        </View>
      </Glass>
    </View>
  );
}
