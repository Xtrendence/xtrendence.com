import { useCallback, useEffect, useState } from 'react';
import React, {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAPI } from '../hooks/useAPI';
import { useAuth } from '../hooks/useAuth';
import Glass from '../components/core/Glass';
import { mainColors } from '../assets/colors/mainColors';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import BotIcon from '../assets/svg/BotIcon';
import CameraIcon from '../assets/svg/CameraIcon';
import { useCameraPermission } from 'react-native-vision-camera';
import CameraView from '../components/core/CameraView';
import { usePage } from '../hooks/usePage';
import { useStorage } from '../hooks/useStorage';
import { useDebounce } from '../hooks/useDebounce';
import LoadingScreen from '../components/core/LoadingScreen';
import { validJSON, wait } from '../utils/utils';

const style = (props?: {
  isKeyboardVisible?: boolean;
  keyboardHeight?: number;
}) =>
  StyleSheet.create({
    loginWrapper: {
      marginTop: props?.isKeyboardVisible && props?.keyboardHeight ? 64 : 0,
    },
    botContainer: {
      display: 'flex',
      marginLeft: 'auto',
      marginRight: 'auto',
      width: 80,
      height: 80,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 40,
      overflow: 'hidden',
      marginBottom: 16,
    },
    botIcon: {
      width: 64,
      height: 64,
      marginTop: -4,
    },
    loginContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    header: {
      marginBottom: 16,
      color: mainColors.accentContrast,
      fontSize: 24,
      fontWeight: 'bold',
    },
    inputRow: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      columnGap: 10,
    },
    inputUrl: {
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      color: mainColors.accentContrast,
      padding: 0,
      paddingLeft: 12,
      paddingRight: 12,
      marginBottom: 10,
      height: 40,
      width: 200,
    },
    input: {
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      color: mainColors.accentContrast,
      padding: 0,
      paddingLeft: 12,
      paddingRight: 12,
      height: 40,
      width: 150,
    },
    cameraButton: {
      height: 40,
      width: 40,
      padding: 10,
      backgroundColor: mainColors.glassOverlay,
      borderRadius: 8,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraIcon: {
      width: 24,
      height: 24,
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

export default function Login() {
  const { storage } = useStorage();

  const page = usePage();
  const auth = useAuth();

  const { apiUrl, setApiUrl, sendRequest } = useAPI();
  const { hasPermission, requestPermission } = useCameraPermission();

  const { isKeyboardVisible, keyboardHeight } = useKeyboardVisible();

  const [cameraVisible, setCameraVisible] = useState(false);
  const [scanned, setScanned] = useState<Array<string | undefined>>();

  const [loading, setLoading] = useState<boolean>(true);
  const [verification, setVerification] = useState({
    attempted: false,
    valid: false,
  });

  const [url, setUrl] = useState<string>(apiUrl || '');
  const debouncedUrl = useDebounce<string>(url, 1000);
  const [token, setToken] = useState<string>();

  useEffect(() => {
    if (scanned && scanned?.length > 0) {
      if (scanned[0] && validJSON(scanned[0])) {
        const parsed = JSON.parse(scanned[0]);
        setUrl(parsed?.domain);
        setToken(parsed?.token);
        setCameraVisible(false);
        setScanned([]);
      }
    }
  }, [scanned]);

  const handleVerify = useCallback(
    async (authToken?: string | undefined) => {
      try {
        setLoading(true);

        console.log('Verifying...');

        setApiUrl(debouncedUrl);

        const response = await sendRequest('POST', '/auth/verify', {
          token: authToken || auth?.token,
        });

        const valid =
          response?.status === 200 && response?.data?.valid === true;

        setVerification({
          attempted: true,
          valid,
        });

        await wait(1000);

        if (valid) {
          auth?.setToken(authToken || auth?.token || '');
          auth?.setLoggedIn(true);
          page.setPage('conversation');
          storage?.set('token', authToken || auth?.token || '');
          setLoading(false);
          return;
        }

        auth?.setToken('');
        storage?.set('token', '');
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.log(error);
      }
    },
    [auth, page, sendRequest, setApiUrl, storage, debouncedUrl],
  );

  useEffect(() => {
    if (!verification.attempted && !verification.valid) {
      handleVerify();
    }
  }, [handleVerify, verification]);

  if (cameraVisible && hasPermission) {
    return (
      <CameraView setCameraVisible={setCameraVisible} setScanned={setScanned} />
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={style({ isKeyboardVisible, keyboardHeight }).loginWrapper}>
      <Glass wrapperStyle={style().botContainer}>
        <BotIcon fill={mainColors.accentContrast} style={style().botIcon} />
      </Glass>
      <Glass>
        <View style={style().loginContainer}>
          <Text style={style().header}>Login</Text>
          <TextInput
            placeholder="API URL..."
            value={url}
            onEndEditing={() => setApiUrl(url)}
            onChangeText={(value: string) => setUrl(value)}
            cursorColor={mainColors.accent}
            style={style().inputUrl}
            placeholderTextColor={mainColors.accentContrast}
          />
          <View style={style().inputRow}>
            <TextInput
              placeholder="Token..."
              value={token}
              onChangeText={(value: string) => setToken(value)}
              secureTextEntry={true}
              cursorColor={mainColors.accent}
              style={style().input}
              placeholderTextColor={mainColors.accentContrast}
            />
            <TouchableOpacity
              style={style().cameraButton}
              onPress={() => {
                if (!hasPermission) {
                  requestPermission();
                  return;
                }

                setCameraVisible(true);
              }}>
              <CameraIcon
                fill={mainColors.accentContrast}
                style={style().cameraIcon}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={style().button}
            onPress={() => handleVerify(token)}>
            <Text style={style().buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </Glass>
    </View>
  );
}
