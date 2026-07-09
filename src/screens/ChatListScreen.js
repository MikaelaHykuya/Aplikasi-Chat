import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Image, Animated, Dimensions, Alert, AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { chats as chatsApi } from '../services/api';
import { API_URL } from '../config/api';

const { width: W } = Dimensions.get('window');

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// Animated avatar with online ring
function Avatar({ uri, name, size = 54, online = false, colors, isGroup }) {
  const color = isGroup ? colors.accentTeal : colors.primary;
  return (
    <View style={{ width: size + (online ? 4 : 0), height: size + (online ? 4 : 0), marginRight: 14 }}>
      {online && (
        <View style={{
          position: 'absolute', inset: 0, borderRadius: (size + 4) / 2,
          borderWidth: 2.5, borderColor: colors.online, zIndex: 1,
        }} />
      )}
      {uri ? (
        <Image source={{ uri: `${API_URL}${uri}` }}
          style={{ width: size, height: size, borderRadius: size / 2, margin: online ? 2 : 0 }} />
      ) : (
        <LinearGradient
          colors={isGroup ? ['#4ECDC4', '#44A1E0'] : ['#6C63FF', '#8B84FF']}
          style={{ width: size, height: size, borderRadius: size / 2, margin: online ? 2 : 0,
            justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

function ChatItem({ chat, onPress, currentUserId, colors, onlineUsers, mode }) {
  const otherMember = chat.members?.find(m => m.id !== currentUserId);
  const displayName = chat.type === 'group' ? chat.name : (otherMember?.displayName || otherMember?.username || 'Unknown');
  const avatar = chat.type === 'group' ? chat.avatar : otherMember?.avatar;
  const isOnline = chat.type === 'direct' && otherMember && onlineUsers?.[otherMember.id] === 'online';
  const hasUnread = false; // TODO: unread count

  return (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.card }]}
      onPress={() => onPress(chat)}
      onLongPress={() => onPress(chat, true)}
      activeOpacity={0.7}
    >
      <Avatar
        uri={avatar}
        name={displayName}
        online={isOnline}
        colors={colors}
        isGroup={chat.type === 'group'}
      />
      <View style={styles.chatInfo}>
        <View style={styles.chatTop}>
          <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.chatTime, { color: colors.textTertiary }]}>
            {timeLabel(chat.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.chatBottom}>
          <Text style={[styles.lastMsg, { color: colors.textSecondary }]} numberOfLines={1}>
            {chat.lastMessage
              ? chat.lastMessage.startsWith('[') ? '📎 Media' : chat.lastMessage
              : 'Ketuk untuk memulai chat'}
          </Text>
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadText}>3</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { colors, mode } = useTheme();
  const [chatList, setChatList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

  const [archivedChats, setArchivedChats] = useState({});
  const [mutedChats, setMutedChats] = useState({});
  const [deletedChats, setDeletedChats] = useState({});

  async function loadPreferences() {
    try {
      const arch = await AsyncStorage.getItem('archivedChats');
      const mut = await AsyncStorage.getItem('mutedChats');
      const del = await AsyncStorage.getItem('deletedChats');
      if (arch) setArchivedChats(JSON.parse(arch));
      if (mut) setMutedChats(JSON.parse(mut));
      if (del) setDeletedChats(JSON.parse(del));
    } catch (e) {}
  }

  async function loadChats() {
    try {
      const data = await chatsApi.getAll();
      setChatList(data);
    } catch (err) {}
  }

  useFocusEffect(useCallback(() => { loadChats(); loadPreferences(); }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        loadChats();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', loadChats);
    socket.on('chat:created', loadChats);
    return () => {
      socket.off('message:new', loadChats);
      socket.off('chat:created', loadChats);
    };
  }, [socket]);

  function handleRefresh() {
    setRefreshing(true);
    loadChats().finally(() => setRefreshing(false));
  }

  function toggleSearch() {
    const toValue = searchOpen ? 0 : 1;
    setSearchOpen(!searchOpen);
    if (searchOpen) setSearch('');
    Animated.spring(searchAnim, { toValue, useNativeDriver: false, tension: 80, friction: 10 }).start();
  }

  const searchHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });

  async function togglePreference(key, chatId, stateObj, setStateFn) {
    const newState = { ...stateObj };
    if (newState[chatId]) delete newState[chatId];
    else newState[chatId] = key === 'deletedChats' ? Date.now() : true;
    setStateFn(newState);
    await AsyncStorage.setItem(key, JSON.stringify(newState));
  }

  function handleChatAction(chat) {
    const otherMember = chat.members?.find(m => m.id !== user?.id);
    const name = chat.type === 'group' ? chat.name : (otherMember?.displayName || otherMember?.username);
    
    Alert.alert(`Opsi Obrolan: ${name}`, 'Apa yang ingin Anda lakukan?', [
      {
        text: archivedChats[chat.id] ? 'Batal Arsip' : 'Arsipkan',
        onPress: () => togglePreference('archivedChats', chat.id, archivedChats, setArchivedChats)
      },
      {
        text: mutedChats[chat.id] ? 'Batal Bisukan' : 'Bisukan',
        onPress: () => togglePreference('mutedChats', chat.id, mutedChats, setMutedChats)
      },
      {
        text: 'Hapus (Sembunyikan)',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Hapus Obrolan', `Obrolan ini akan disembunyikan sampai ada pesan baru. Lanjutkan?`, [
            { text: 'Batal', style: 'cancel' },
            { text: 'Hapus', style: 'destructive', onPress: () => togglePreference('deletedChats', chat.id, deletedChats, setDeletedChats) }
          ]);
        }
      },
      { text: 'Tutup', style: 'cancel' }
    ]);
  }

  const filteredChats = chatList.filter(chat => {
    // If chat was deleted, hide it unless there is a message newer than deletion time
    if (deletedChats[chat.id] && new Date(chat.lastMessageAt).getTime() <= deletedChats[chat.id]) {
      return false;
    }
    // Filter out archived chats from main list
    if (archivedChats[chat.id]) return false;

    if (!search) return true;
    const otherMember = chat.members?.find(m => m.id !== user?.id);
    const name = chat.type === 'group' ? chat.name : (otherMember?.displayName || otherMember?.username);
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  const hasArchivedChats = Object.keys(archivedChats).some(id => {
    // only count if it's not permanently deleted/hidden
    const c = chatList.find(c => c.id === id);
    if (!c) return false;
    if (deletedChats[id] && new Date(c.lastMessageAt).getTime() <= deletedChats[id]) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header gradient */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerGreeting}>Halo 👋</Text>
          <Text style={styles.headerTitle}>{user?.displayName || user?.username}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn}>
            <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Friends')} style={styles.headerBtn}>
            <Ionicons name="person-add-outline" size={21} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={[styles.headerAvatarBtn]}
          >
            {user?.avatar ? (
              <Image source={{ uri: `${API_URL}${user.avatar}` }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarText}>
                  {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Animated Search */}
      <Animated.View style={[styles.searchContainer, { height: searchHeight, overflow: 'hidden' }]}>
        <View style={[styles.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Cari nama atau pesan..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* Section header */}
      {hasArchivedChats && !search && (
        <TouchableOpacity 
          style={[styles.archiveBtn, { borderBottomColor: colors.borderLight }]}
          onPress={() => navigation.navigate('ArchivedChats')}
        >
          <Ionicons name="archive" size={20} color={colors.textSecondary} />
          <Text style={[styles.archiveText, { color: colors.textSecondary }]}>
            Obrolan Diarsipkan
          </Text>
        </TouchableOpacity>
      )}

      <View style={[styles.sectionHeader, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {search ? `Hasil pencarian` : `Semua Chat`}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.primary }]}>{filteredChats.length}</Text>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            onPress={(c, isLongPress) => {
              if (isLongPress) handleChatAction(c);
              else navigation.navigate('Chat', { chatId: c.id, chat: c });
            }}
            currentUserId={user?.id}
            colors={colors}
            onlineUsers={onlineUsers}
            mode={mode}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />}
        contentContainerStyle={[
          { paddingBottom: 100 },
          filteredChats.length === 0 && { flex: 1 }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[colors.primary + '18', colors.accentTeal + '10']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="chatbubbles-outline" size={52} color={colors.primary} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {search ? 'Tidak ditemukan' : 'Belum ada percakapan'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {search ? 'Coba kata kunci lain' : 'Tambah teman dan mulai ngobrol!'}
            </Text>
            {!search && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Friends')}
              >
                <Text style={styles.emptyBtnText}>Cari Teman</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fabWrap}
        onPress={() => navigation.navigate('GroupCreate')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="create-outline" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 58, paddingBottom: 18, paddingHorizontal: 20,
  },
  headerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarBtn: {
    width: 38, height: 38, borderRadius: 19, marginLeft: 4,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden',
  },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  searchContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, height: 40,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  archiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, gap: 8
  },
  archiveText: { fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionCount: { fontSize: 12, fontWeight: '800' },
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  chatInfo: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '700', flex: 1, letterSpacing: -0.1 },
  chatTime: { fontSize: 11, fontWeight: '500', marginLeft: 8 },
  chatBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMsg: { fontSize: 14, flex: 1, lineHeight: 18 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  separator: { height: 0.5, marginLeft: 88 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconBg: {
    width: 100, height: 100, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 24, paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 14, shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  fabWrap: {
    position: 'absolute', right: 20, bottom: 90,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  fab: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
