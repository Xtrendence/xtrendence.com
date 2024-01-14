import React, { Text, TouchableOpacity, View } from 'react-native';
import { usePage } from '../hooks/usePage';
import { useAuth } from '../hooks/useAuth';

export default function Conversation() {
  const { setPage } = usePage();
  const auth = useAuth();

  return (
    <View>
      <Text>Conversation</Text>
      <TouchableOpacity
        onPress={() => {
          auth.logout();
          setPage('login');
        }}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
