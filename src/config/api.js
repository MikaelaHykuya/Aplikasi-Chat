import { Platform } from 'react-native';

const DEV_API_URL = 'https://four-feet-sit.loca.lt';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
export const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
