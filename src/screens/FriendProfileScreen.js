import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { users as usersApi, chats as chatsApi } from '../services/api';
import { API_URL } from '../config/api';

export default function FriendProfileScreen({ route, navigation }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { colors } = useTheme();
  const { userId, chatId } = route.params;
  const [profile, setProfile] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedChatId, setResolvedChatId] = useState(chatId || null);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await usersApi.getById(userId);
      setProfile(data);
    } catch (err) { } finally { setLoading(false); }
    try {
      const friends = await usersApi.getFriends();
      if (friends.some(f => f.id === userId && f.blocked)) setBlocked(true);
    } catch (err) {}
      // Try to find existing chatId for this direct chat
      if (!resolvedChatId) {
        try {
          const allChats = await chatsApi.getAll();
          const direct = allChats.find(c => c.type === 'direct' && c.members?.some(m => m.id === userId));
          if (direct) setResolvedChatId(direct.id);
        } catch (err) {}
      }

      // Load preferences if we have a chatId
      const currentChatId = resolvedChatId || (await (async () => {
        try {
          const allChats = await chatsApi.getAll();
          const direct = allChats.find(c => c.type === 'direct' && c.members?.some(m => m.id === userId));
          return direct?.id;
        } catch (e) { return null; }
      })());

      if (currentChatId) {
        try {
          const mut = await AsyncStorage.getItem('mutedChats');
          const arch = await AsyncStorage.getItem('archivedChats');
          if (mut && JSON.parse(mut)[currentChatId]) setIsMuted(true);
          if (arch && JSON.parse(arch)[currentChatId]) setIsArchived(true);
        } catch (e) {}
      }
    }

  async function togglePreference(key, stateVal, setStateFn) {
    if (!resolvedChatId) {
      Alert.alert('', 'Mulai percakapan terlebih dahulu untuk menggunakan fitur ini');
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(key);
      const data = stored ? JSON.parse(stored) : {};
      if (data[resolvedChatId]) delete data[resolvedChatId];
      else data[resolvedChatId] = true;
      setStateFn(!stateVal);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  function startChat() {
    if (socket) {
      socket.emit('chat:create', { type: 'direct', memberIds: [userId] });
      socket.once('chat:created', (chat) => {
        setResolvedChatId(chat.id);
        navigation.navigate('ChatList');
        navigation.navigate('Chat', { chatId: chat.id, chat: { ...chat, members: [{ id: user.id }, { id: userId, displayName: profile?.displayName }] } });
      });
    }
  }

  async function toggleBlock() {
    try {
      if (blocked) {
        await usersApi.unblockUser(userId);
        setBlocked(false);
        Alert.alert('', 'Blokir dibuka');
      } else {
        Alert.alert('Blokir', 'Pengguna ini tidak bisa mengirim pesan atau melihat status Anda.', [
          { text: 'Batal', style: 'cancel' },
          { text: 'Blokir', style: 'destructive', onPress: async () => {
            await usersApi.blockUser(userId);
            setBlocked(true);
          } },
        ]);
      }
    } catch (err) { Alert.alert('Error', err.message); }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView style={styles.body}>
        <View style={[styles.avatarSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {profile?.avatar ? (
            <Image source={{ uri: `${API_URL}${profile.avatar}` }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>{(profile?.displayName || profile?.username || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.text }]}>{profile?.displayName || profile?.username}</Text>
          <Text style={[styles.username, { color: colors.textSecondary }]}>@{profile?.username}</Text>
          {profile?.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={startChat}>
            <Ionicons name="chatbubble-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>Kirim Pesan</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => {
              if (resolvedChatId) {
                navigation.navigate('MediaFileLinks', { chatId: resolvedChatId, name: profile?.displayName || profile?.username });
              } else {
                Alert.alert('', 'Mulai percakapan terlebih dahulu untuk melihat media');
              }
            }}
          >
            <Ionicons name="image-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Media, File & Tautan</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Bisukan</Text>
            <Switch value={isMuted} onValueChange={() => togglePreference('mutedChats', isMuted, setIsMuted)} trackColor={{ true: colors.primary }} />
          </View>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Ionicons name="archive-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Arsipkan Obrolan</Text>
            <Switch value={isArchived} onValueChange={() => togglePreference('archivedChats', isArchived, setIsArchived)} trackColor={{ true: colors.primary }} />
          </View>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
            <Ionicons name="warning-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Laporkan</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.row} onPress={toggleBlock}>
            <Ionicons name="ban-outline" size={20} color={blocked ? '#ff4444' : colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, blocked ? { color: '#ff4444' } : { color: colors.text }]}>
              {blocked ? 'Buka Blokir' : 'Blokir'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 0.3 },
  body: { flex: 1 },
  avatarSection: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 6,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { backgroundColor: '#07C160', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 38, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  username: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  card: {
    marginTop: 16, marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 12, paddingVertical: 12, borderRadius: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  rowIcon: { marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 16 },
});
