import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, Alert, AppState, Text, Platform } from 'react-native';
import { NavigationContainer, useNavigation, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { getSettings as getSettingsApi } from '../services/api';
import { getStorage, getCachedSettings } from '../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import FriendsScreen from '../screens/FriendsScreen';
import FriendProfileScreen from '../screens/FriendProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GroupCreateScreen from '../screens/GroupCreateScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import ArchivedChatsScreen from '../screens/ArchivedChatsScreen';
import StatusScreen from '../screens/StatusScreen';
import CreateStatusScreen from '../screens/CreateStatusScreen';
import ViewStatusScreen from '../screens/ViewStatusScreen';
import CallsScreen from '../screens/CallsScreen';
import CallScreen from '../screens/CallScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccountScreen from '../screens/AccountScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import BackupChatScreen from '../screens/BackupChatScreen';
import PinLockScreen from '../screens/PinLockScreen';
import MediaFileLinksScreen from '../screens/MediaFileLinksScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ArchivedChats" component={ArchivedChatsScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="GroupCreate" component={GroupCreateScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
      <Stack.Screen name="MediaFileLinks" component={MediaFileLinksScreen} />
    </Stack.Navigator>
  );
}

function StatusStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatusList" component={StatusScreen} />
      <Stack.Screen name="CreateStatus" component={CreateStatusScreen} />
      <Stack.Screen name="ViewStatus" component={ViewStatusScreen} />
    </Stack.Navigator>
  );
}

function CallsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CallsList" component={CallsScreen} />
      <Stack.Screen name="Call" component={CallScreen} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="BackupChat" component={BackupChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="GroupCreate" component={GroupCreateScreen} />
    </Stack.Navigator>
  );
}

function NotificationHandler() {
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket) return;
    const handler = async (data) => {
      if (data.senderId === user?.id) return;
      try {
        const mut = await AsyncStorage.getItem('mutedChats');
        if (mut) {
          const muted = JSON.parse(mut);
          if (muted[data.chatId]) return; // Skip if muted
        }
      } catch (e) {}

      Alert.alert(
        data.senderName || 'Pesan baru',
        data.type === 'text' ? data.content : '[Media]',
        [
          { text: 'Tutup', style: 'cancel' },
          { text: 'Buka', onPress: () => {
            navigation.navigate('Chats', {
              screen: 'Chat',
              params: { chatId: data.chatId },
            });
          }},
        ]
      );
    };
    socket.on('message:new', handler);
    return () => socket.off('message:new', handler);
  }, [socket, user]);

  return null;
}

function CallHandler() {
  const navigation = useNavigation();
  const { socket, incomingCall, setIncomingCall } = useSocket();

  useEffect(() => {
    if (!incomingCall || !socket) return;
    
    navigation.navigate('Chats', {
      screen: 'Call',
      params: {
        type: incomingCall.type || 'voice',
        targetUser: { id: incomingCall.callerId, displayName: incomingCall.callerDisplayName, avatar: incomingCall.callerAvatar },
        direction: 'incoming',
        offer: incomingCall.offer,
        autoAccept: false,
      },
    });
    setIncomingCall(null);
  }, [incomingCall]);

  return null;
}

function getTabBarStyle(route, colors, mode) {
  const routeName = getFocusedRouteNameFromRoute(route) ?? '';
  const hiddenRoutes = ['Chat', 'FriendProfile', 'GroupCreate', 'GroupInfo', 'Call', 'MediaFileLinks', 'CreateStatus', 'ViewStatus', 'Account', 'Privacy', 'ChatSettings', 'NotificationSettings', 'BackupChat', 'Profile'];
  
  if (hiddenRoutes.includes(routeName)) {
    return { display: 'none' };
  }

  if (Platform.OS === 'ios') {
    return {
      backgroundColor: colors.tabBar,
      borderTopWidth: 1,
      borderTopColor: colors.tabBarBorder,
      height: 88, // iOS standard with home indicator
      paddingBottom: 28,
      paddingTop: 8,
      position: 'absolute',
    };
  }

  return {
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    borderRadius: 24,
    marginHorizontal: 12,
    marginBottom: 12,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: mode === 'dark' ? 0.4 : 0.12,
    shadowRadius: 20,
    elevation: 16,
    position: 'absolute',
  };
}

function MainTabs() {
  const { colors, mode } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: getTabBarStyle(route, colors, mode),
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <View style={{ flex: 1, backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }} />
          ) : null
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
        tabBarItemStyle: { borderRadius: 16 },
      })}
    >
      <Tab.Screen name="Chats" component={ChatStack}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ color, focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center',
            backgroundColor: focused ? color + '18' : 'transparent',
            borderRadius: 12, width: 36, height: 36 }}>
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
          </View>
        )}}
      />
      <Tab.Screen name="StatusTab" component={StatusStack}
        options={{ tabBarLabel: 'Status', tabBarIcon: ({ color, focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center',
            backgroundColor: focused ? color + '18' : 'transparent',
            borderRadius: 12, width: 36, height: 36 }}>
            <Ionicons name={focused ? 'radio-button-on' : 'radio-button-off'} size={22} color={color} />
          </View>
        )}}
      />
      <Tab.Screen name="CallsTab" component={CallsStack}
        options={{ tabBarLabel: 'Panggilan', tabBarIcon: ({ color, focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center',
            backgroundColor: focused ? color + '18' : 'transparent',
            borderRadius: 12, width: 36, height: 36 }}>
            <Ionicons name={focused ? 'call' : 'call-outline'} size={22} color={color} />
          </View>
        )}}
      />
      <Tab.Screen name="SettingsTab" component={SettingsStack}
        options={{ tabBarLabel: 'Saya', tabBarIcon: ({ color, focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center',
            backgroundColor: focused ? color + '18' : 'transparent',
            borderRadius: 12, width: 36, height: 36 }}>
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          </View>
        )}}
      />
    </Tab.Navigator>
  );
}


function MainWithHandler() {
  return (
    <>
      <MainTabs />
      <NotificationHandler />
      <CallHandler />
    </>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const [appLocked, setAppLocked] = useState(true);
  const [checkingLock, setCheckingLock] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!user) {
      setAppLocked(false);
      setCheckingLock(false);
      return;
    }

    async function checkLock() {
      try {
        const cached = getCachedSettings();
        const settings = cached || await getSettingsApi();
        const pin = await getStorage('appLockPin');
        if (settings.appLock && pin) {
          setAppLocked(true);
        } else {
          setAppLocked(false);
        }
      } catch {}
      setCheckingLock(false);
    }
    checkLock();
  }, [user]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        getStorage('appLockPin').then(pin => {
          const cached = getCachedSettings();
          if (cached?.appLock && pin) setAppLocked(true);
        }).catch(() => {});
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  if (loading || checkingLock) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        appLocked ? (
          <PinLockScreen onUnlock={() => setAppLocked(false)} />
        ) : (
          <MainWithHandler />
        )
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
