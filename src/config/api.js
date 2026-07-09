import { Platform } from 'react-native';

const DEV_API_URL = 'http://192.168.0.226:3000';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
export const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
// WEBVIEW_URL is required to be HTTPS so Android WebView allows WebRTC getUserMedia.
export const WEBVIEW_URL = 'https://a3867fcc0b9e785d-111-94-80-167.serveousercontent.com';
