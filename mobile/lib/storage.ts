import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const WEB_KEY = 'bmak_web_uid';

export async function getWebUid(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(WEB_KEY);
  }
  return SecureStore.getItemAsync(WEB_KEY);
}

export async function setWebUid(uid: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(WEB_KEY, uid);
    return;
  }
  return SecureStore.setItemAsync(WEB_KEY, uid);
}

export async function clearWebUid(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(WEB_KEY);
    return;
  }
  return SecureStore.deleteItemAsync(WEB_KEY);
}
