import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getSettings } from '../services/api';
import { onSettingsChange, getCachedSettings } from '../services/storage';

const themes = {
  light: {
    // Core backgrounds
    background: '#F5F6FA',
    surface: '#EBEBF5',
    card: '#FFFFFF',
    cardElevated: '#FAFAFA',

    // Brand
    primary: '#6C63FF',
    primaryLight: '#8B84FF',
    primaryDark: '#4A42D9',
    gradientStart: '#6C63FF',
    gradientEnd: '#4ECDC4',
    accentPink: '#FF6B9D',
    accentTeal: '#4ECDC4',
    accentOrange: '#FF9F43',

    // Text
    text: '#1A1A2E',
    textSecondary: '#8E8E9A',
    textTertiary: '#B0B0BA',
    textOnPrimary: '#FFFFFF',

    // Bubbles
    bubbleSelf: '#6C63FF',
    bubbleSelfText: '#fff',
    bubbleOther: '#FFFFFF',
    bubbleOtherText: '#1A1A2E',

    // UI Elements
    border: '#EBEBF0',
    borderLight: '#F2F2F7',
    separator: '#E5E5EA',
    inputBg: '#F0F1F8',
    inputBorder: '#DCDCEC',
    shadow: '#6C63FF',
    overlay: 'rgba(0,0,0,0.45)',

    // Tab & Header
    headerBg: '#6C63FF',
    headerText: '#fff',
    tabBar: '#FFFFFF',
    tabBarBorder: '#EBEBF0',
    tabBarActive: '#6C63FF',

    // Status
    online: '#2ED573',
    danger: '#FF4757',
    warning: '#FFA502',
    success: '#2ED573',

    // Message status
    read: '#4ECDC4',
    delivered: '#B0B0BA',
  },
  dark: {
    // Core backgrounds
    background: '#0B0B12',
    surface: '#111118',
    card: '#14141F',
    cardElevated: '#1A1A28',

    // Brand
    primary: '#7B74FF',
    primaryLight: '#9B95FF',
    primaryDark: '#5A52D9',
    gradientStart: '#7B74FF',
    gradientEnd: '#4ECDC4',
    accentPink: '#FF6B9D',
    accentTeal: '#4ECDC4',
    accentOrange: '#FF9F43',

    // Text
    text: '#E8E8F0',
    textSecondary: '#8E8E9A',
    textTertiary: '#5A5A6A',
    textOnPrimary: '#FFFFFF',

    // Bubbles
    bubbleSelf: '#7B74FF',
    bubbleSelfText: '#fff',
    bubbleOther: '#1E1E2E',
    bubbleOtherText: '#E8E8F0',

    // UI Elements
    border: '#1E1E2E',
    borderLight: '#181828',
    separator: '#1E1E2E',
    inputBg: '#1A1A28',
    inputBorder: '#2A2A3E',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.65)',

    // Tab & Header
    headerBg: '#0B0B12',
    headerText: '#E8E8F0',
    tabBar: '#14141F',
    tabBarBorder: '#1E1E2E',
    tabBarActive: '#7B74FF',

    // Status
    online: '#2ED573',
    danger: '#FF4757',
    warning: '#FFA502',
    success: '#2ED573',

    // Message status
    read: '#4ECDC4',
    delivered: '#5A5A6A',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState(getCachedSettings() || {});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    return onSettingsChange((s) => {
      setSettings({ ...s });
    });
  }, []);

  const themePref = settings.theme || 'System';
  const mode = themePref === 'System' ? systemScheme || 'light' : themePref === 'Gelap' ? 'dark' : 'light';
  const colors = themes[mode] || themes.light;

  return (
    <ThemeContext.Provider value={{ colors, mode, settings, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
