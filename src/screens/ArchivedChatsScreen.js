import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
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

function Avatar({ uri, name, size = 54, colors, isGroup }) {
  return (
    <View style={{ width: size, height: size, marginRight: 14 }}>
      {uri ? (
        <Image source={{ uri: `${API_URL}${uri}` }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <LinearGradient
          colors={isGroup ? ['#4ECDC4', '#44A1E0'] : ['#6C63FF', '#8B84FF']}
          style={{ width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

function ChatItem({ chat, onPress, currentUserId, colors }) {
  const otherMember = chat.members?.find(m => m.id !== currentUserId);
  const displayName = chat.type === 'group' ? chat.name : (otherMember?.displayName || otherMember?.username || 'Unknown');
  const avatar = chat.type === 'group' ? chat.avatar : otherMember?.avatar;

  return (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.card }]}
      onPress={() => onPress(chat)}
      onLongPress={() => onPress(chat, true)}
      activeOpacity={0.7}
    >
      <Avatar uri={avatar} name={displayName} colors={colors} isGroup={chat.type === 'group'} />
      <View style={styles.chatInfo}>
        <View style={styles.chatTop}>
          <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.chatTime, { color: colors.textTertiary }]}>{timeLabel(chat.lastMessageAt)}</Text>
        </View>
        <View style={styles.chatBottom}>
          <Text style={[styles.lastMsg, { color: colors.textSecondary }]} numberOfLines={1}>
            {chat.lastMessage ? (chat.lastMessage.startsWith('[') ? '📎 Media' : chat.lastMessage) : 'Ketuk untuk memulai chat'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ArchivedChatsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [chatList, setChatList] = useState([]);
  const [archivedChats, setArchivedChats] = useState({});
  const [deletedChats, setDeletedChats] = useState({});

  async function loadPreferences() {
    try {
      const arch = await AsyncStorage.getItem('archivedChats');
      const del = await AsyncStorage.getItem('deletedChats');
      if (arch) setArchivedChats(JSON.parse(arch));
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

  async function handleUnarchive(chatId) {
    const newState = { ...archivedChats };
    delete newState[chatId];
    setArchivedChats(newState);
    await AsyncStorage.setItem('archivedChats', JSON.stringify(newState));
  }

  function handleChatAction(chat) {
    const otherMember = chat.members?.find(m => m.id !== user?.id);
    const name = chat.type === 'group' ? chat.name : (otherMember?.displayName || otherMember?.username);
    
    Alert.alert(`Opsi Arsip: ${name}`, 'Apa yang ingin Anda lakukan?', [
      { text: 'Batal Arsipkan', onPress: () => handleUnarchive(chat.id) },
      { text: 'Tutup', style: 'cancel' }
    ]);
  }

  const filteredChats = chatList.filter(chat => {
    if (deletedChats[chat.id] && new Date(chat.lastMessageAt).getTime() <= deletedChats[chat.id]) return false;
    return archivedChats[chat.id];
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Obrolan Diarsipkan</Text>
          <View style={{ width: 44 }} />
        </View>
      </LinearGradient>

      {filteredChats.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="archive-outline" size={60} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Tidak ada obrolan yang diarsipkan</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ChatItem
              chat={item}
              currentUserId={user?.id}
              colors={colors}
              onPress={(chat, isLong) => isLong ? handleChatAction(chat) : navigation.navigate('Chat', { chatId: chat.id, type: chat.type })}
            />
          )}
          contentContainerStyle={{ paddingVertical: 10 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  chatItem: { flexDirection: 'row', padding: 16, marginHorizontal: 16, marginBottom: 12, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  chatInfo: { flex: 1, justifyContent: 'center' },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, fontWeight: '600' },
  chatBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMsg: { fontSize: 14, flex: 1, marginRight: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16 },
});
