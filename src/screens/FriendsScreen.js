import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, RefreshControl, ActivityIndicator, Image, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { users as usersApi } from '../services/api';
import { API_URL } from '../config/api';

function UserAvatar({ uri, name, size = 50, online = false, colors }) {
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
          colors={['#6C63FF', '#8B84FF']}
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

const TABS = ['Teman', 'Permintaan', 'Cari'];

export default function FriendsScreen({ navigation }) {
  const { colors, mode } = useTheme();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [tab, setTab] = useState(0);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const [f, r] = await Promise.all([usersApi.getFriends(), usersApi.getFriendRequests()]);
      setFriends(f);
      setRequests(r);
    } catch (err) {}
  }

  function handleRefresh() {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }

  async function handleSearch(q) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await usersApi.search(q);
      setSearchResults(results);
    } catch (err) {} finally { setSearching(false); }
  }

  async function sendRequest(toUserId) {
    try {
      await usersApi.sendFriendRequest(toUserId);
      Alert.alert('✅ Terkirim', 'Permintaan pertemanan dikirim');
      setSearchQuery(''); setSearchResults([]);
    } catch (err) { Alert.alert('Error', err.message); }
  }

  async function respondRequest(id, action) {
    try {
      await usersApi.respondFriendRequest(id, action);
      loadData();
    } catch (err) { Alert.alert('Error', err.message); }
  }

  function startChat(friend) {
    if (socket) {
      socket.emit('chat:create', { type: 'direct', memberIds: [friend.id] });
      socket.once('chat:created', (chat) => {
        navigation.navigate('ChatList');
        navigation.navigate('Chat', { chatId: chat.id, chat: { ...chat, members: [{ id: user.id }, { id: friend.id, displayName: friend.displayName }] } });
      });
    }
  }

  function switchTab(i) {
    setTab(i);
    Animated.spring(tabAnim, { toValue: i, useNativeDriver: false, tension: 100, friction: 12 }).start();
  }

  function renderFriend({ item }) {
    const isOnline = onlineUsers[item.id] === 'online';
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card }]}
        onPress={() => startChat(item)}
        activeOpacity={0.7}
      >
        <UserAvatar uri={item.avatar} name={item.displayName || item.username} online={isOnline} colors={colors} />
        <TouchableOpacity style={styles.rowInfo} onPress={() => navigation.navigate('FriendProfile', { userId: item.id })}>
          <Text style={[styles.rowName, { color: colors.text }]}>{item.displayName || item.username}</Text>
          <View style={styles.statusRow}>
            {isOnline && <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />}
            <Text style={[styles.rowSub, { color: isOnline ? colors.online : colors.textSecondary }]}>
              {isOnline ? 'Sedang online' : '@' + item.username}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chatBtn, { backgroundColor: colors.primary + '18' }]}
          onPress={() => startChat(item)}
        >
          <Ionicons name="chatbubble-ellipses" size={19} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  function renderRequest({ item }) {
    return (
      <View style={[styles.row, { backgroundColor: colors.card }]}>
        <UserAvatar uri={item.avatar} name={item.displayName || item.username} colors={colors} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.text }]}>{item.displayName || item.username}</Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>@{item.username}</Text>
        </View>
        <View style={styles.reqActions}>
          <TouchableOpacity
            style={[styles.reqBtn, { backgroundColor: colors.primary }]}
            onPress={() => respondRequest(item.id, 'accepted')}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reqBtn, { backgroundColor: colors.border }]}
            onPress={() => respondRequest(item.id, 'rejected')}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSearchResult({ item }) {
    const isFriend = friends.some(f => f.id === item.id);
    return (
      <View style={[styles.row, { backgroundColor: colors.card }]}>
        <UserAvatar uri={item.avatar} name={item.displayName || item.username} colors={colors} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.text }]}>{item.displayName || item.username}</Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>@{item.username}</Text>
        </View>
        {isFriend ? (
          <View style={[styles.friendedBadge, { backgroundColor: colors.online + '20' }]}>
            <Text style={[styles.friendedText, { color: colors.online }]}>✓ Teman</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => sendRequest(item.id)}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.addBtn}
            >
              <Ionicons name="person-add" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.addBtnText}>Tambah</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const tabWidth = 1 / TABS.length;
  const indicatorLeft = tabAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => `${i * (100 / TABS.length)}%`),
  });

  const currentData = tab === 0 ? friends : tab === 1 ? requests : searchResults;
  const currentRenderer = tab === 0 ? renderFriend : tab === 1 ? renderRequest : renderSearchResult;
  const currentEmpty = {
    0: { icon: 'people-outline', title: 'Belum ada teman', sub: 'Cari teman dengan tab Cari' },
    1: { icon: 'person-add-outline', title: 'Tidak ada permintaan', sub: 'Permintaan baru akan muncul di sini' },
    2: { icon: 'search-outline', title: 'Tidak ditemukan', sub: 'Coba nama atau username lain' },
  }[tab];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teman</Text>
        <View style={styles.headerBadgeArea}>
          {requests.length > 0 && (
            <View style={styles.reqBadge}>
              <Text style={styles.reqBadgeText}>{requests.length}</Text>
            </View>
          )}
          <View style={{ width: 10 }} />
        </View>
      </LinearGradient>

      {/* Search (always shown on search tab) */}
      {tab === 2 && (
        <View style={[styles.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Cari username atau nama..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((label, i) => (
          <TouchableOpacity key={i} style={styles.tab} onPress={() => switchTab(i)}>
            <Text style={[styles.tabLabel, {
              color: tab === i ? colors.primary : colors.textSecondary,
              fontWeight: tab === i ? '800' : '500',
            }]}>
              {label}
              {i === 1 && requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Sliding indicator */}
        <Animated.View style={[styles.tabIndicator, {
          backgroundColor: colors.primary,
          width: `${100 / TABS.length}%`,
          left: indicatorLeft,
        }]} />
      </View>

      {/* List */}
      <FlatList
        data={currentData}
        keyExtractor={item => item.id}
        renderItem={currentRenderer}
        refreshControl={
          tab !== 2
            ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            : undefined
        }
        ListHeaderComponent={tab === 2 && searching ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : null}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: currentData.length === 0 ? 1 : 0 }}
        ListEmptyComponent={
          tab === 2 && searchQuery.length < 2 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={44} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Ketik minimal 2 karakter</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[colors.primary + '18', colors.accentTeal + '10']}
                style={styles.emptyIconBg}
              >
                <Ionicons name={currentEmpty.icon} size={44} color={colors.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{currentEmpty.title}</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{currentEmpty.sub}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerBadgeArea: { flexDirection: 'row', alignItems: 'center' },
  reqBadge: {
    backgroundColor: '#FF4757', borderRadius: 10, minWidth: 20, height: 20,
    paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
  },
  reqBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', margin: 14, marginBottom: 0,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { fontSize: 14 },
  tabIndicator: {
    position: 'absolute', bottom: 0, height: 3, borderRadius: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 13,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  rowSub: { fontSize: 13 },
  chatBtn: {
    width: 38, height: 38, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  reqActions: { flexDirection: 'row', gap: 8 },
  reqBtn: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  friendedBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  friendedText: { fontSize: 13, fontWeight: '700' },
  separator: { height: 0.5, marginLeft: 86 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconBg: {
    width: 90, height: 90, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
