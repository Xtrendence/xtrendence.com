import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { PermissionsAndroid } from 'react-native';

PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

AppRegistry.registerComponent(appName, () => App);
