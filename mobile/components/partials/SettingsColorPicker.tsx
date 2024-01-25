/* eslint-disable react-native/no-inline-styles */
import React, { Dispatch, SetStateAction, useCallback, useEffect } from 'react';
import {
  BackHandler,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MainColor, colorsAreValid } from '../../assets/colors/mainColors';
import ColorPicker, {
  HueSlider,
  OpacitySlider,
  Panel1,
  Preview,
  Swatches,
} from 'reanimated-color-picker';
import { useStorage } from '../../hooks/useStorage';

const windowWidth = Dimensions.get('window').width;

const style = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  container: {
    width: windowWidth - 32,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingTop: 16,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 8,
  },
  picker: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    rowGap: 16,
    marginBottom: 16,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 16,
    marginTop: 16,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    color: 'rgb(255, 255, 255)',
    borderRadius: 8,
    padding: 8,
    paddingRight: 16,
    paddingLeft: 16,
    width: 'auto',
  },
  buttonText: {
    color: 'rgb(255, 255, 255)',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function SettingsColorPicker({
  picker,
}: {
  picker: {
    colorPicker: {
      color: MainColor;
      value: string;
      visible: boolean;
      save: boolean;
    };
    setColorPicker: Dispatch<
      SetStateAction<
        | {
            color: MainColor;
            value: string;
            visible: boolean;
            save: boolean;
          }
        | undefined
      >
    >;
  };
}) {
  const { storage } = useStorage();

  useEffect(() => {
    const handleBack = () => {
      picker.setColorPicker(undefined);
      return true;
    };

    BackHandler.addEventListener('hardwareBackPress', handleBack);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBack);
    };
  }, [picker]);

  const onSelectColor = useCallback(
    ({ rgba }: { rgba: string }) => {
      picker.setColorPicker({
        ...picker.colorPicker,
        value: rgba,
      });
    },
    [picker],
  );

  return (
    <GestureHandlerRootView>
      <View style={style.wrapper}>
        <View style={style.container}>
          <ColorPicker
            style={style.picker}
            value={picker.colorPicker.value}
            thumbSize={24}
            onComplete={onSelectColor}>
            <Preview />
            <Panel1 thumbSize={14} />
            <HueSlider sliderThickness={14} />
            <OpacitySlider sliderThickness={14} />
            <Swatches style={{ display: 'none' }} />
          </ColorPicker>
        </View>

        <View style={style.row}>
          <TouchableOpacity
            style={style.button}
            onPress={() => {
              picker.setColorPicker({ ...picker.colorPicker, visible: false });
            }}>
            <Text style={style.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={style.button}
            onPress={() => {
              const colors = storage?.getString('colors') || '';

              colorsAreValid(colors);

              const currentColors = JSON.parse(
                storage?.getString('colors') || '{}',
              );

              const newColors = {
                ...currentColors,
                [picker.colorPicker.color]: picker.colorPicker.value,
              };

              storage?.set('colors', JSON.stringify(newColors));

              picker.setColorPicker({
                ...picker.colorPicker,
                visible: false,
                save: true,
              });
            }}>
            <Text style={style.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
