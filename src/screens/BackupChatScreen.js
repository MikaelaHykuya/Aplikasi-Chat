import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { chats as chatsApi } from '../services/api';
import { API_URL } from '../config/api';

export default function BackupChatScreen({ navigation }) {
  const { colors } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [restoreBusyId, setRestoreBusyId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await chatsApi.getAll();
      setChats(data || []);
    } catch (err) {} finally { setLoading(false); }
  }

  function chatName(chat) {
    if (chat.type === 'group') return chat.name || 'Grup';
    const other = chat.members?.find(m => m.id !== chat._myId);
    return other?.displayName || other?.username || 'Chat';
  }

  async function handleBackup(chat) {
    try {
      setBusyId(chat.id);
      const data = await chatsApi.backup(chat.id);
      const json = JSON.stringify(data, null, 2);
      const b64 = typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(json)))
        : Buffer.from(json).toString('base64');
      await Linking.openURL(`data:application/json;base64,${b64}`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Gagal backup chat');
    } finally { setBusyId(null); }
  }

  async function handleRestore(chat) {
    try {
      setRestoreBusyId(chat.id);
      const { getDocumentAsync } = await import('expo-document-picker');
      const result = await getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setRestoreBusyId(null);
        return;
      }
      const asset = result.assets[0];
      const resp = await fetch(asset.uri);
      const text = await resp.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        Alert.alert('Error', 'File JSON tidak valid');
        setRestoreBusyId(null);
        return;
      }
      const messages = parsed.messages || (Array.isArray(parsed) ? parsed : null);
      if (!messages) {
        Alert.alert('Error', 'Format backup tidak dikenali');
        setRestoreBusyId(null);
        return;
      }
      Alert.alert(
        'Konfirmasi Restore',
        `Akan mengimpor ${messages.length} pesan ke chat ini. Pesan yang sudah ada tidak akan digandakan.`,
        [
          { text: 'Batal', style: 'cancel', onPress: () => setRestoreBusyId(null) },
          {
            text: 'Impor',
            onPress: async () => {
              try {
                const result = await chatsApi.restore(chat.id, messages);
                Alert.alert('Berhasil', result.message || `${result.imported} pesan diimpor`);
              } catch (err) {
                Alert.alert('Error', err.message || 'Gagal restore');
              } finally {
                setRestoreBusyId(null);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Gagal membuka file');
      setRestoreBusyId(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore Chat</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView style={styles.body}>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Backup mengekspor riwayat chat ke file JSON. Restore mengimpor kembali pesan dari file backup.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : chats.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Belum ada chat</Text>
          </View>
        ) : (
          chats.map(chat => (
            <View key={chat.id} style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={[styles.chatIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons
                  name={chat.type === 'group' ? 'people' : 'person'}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.name, { color: colors.text }]}>{chatName(chat)}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {chat.lastMessage ? chat.lastMessage.slice(0, 40) : 'Belum ada pesan'}
                </Text>
              </View>
              <View style={styles.btnGroup}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleBackup(chat)}
                  disabled={busyId === chat.id}
                >
                  {busyId === chat.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="download-outline" size={18} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#4A90D9', marginLeft: 8 }]}
                  onPress={() => handleRestore(chat)}
                  disabled={restoreBusyId === chat.id}
                >
                  {restoreBusyId === chat.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    margin: 16, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  chatIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  btnGroup: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
});
