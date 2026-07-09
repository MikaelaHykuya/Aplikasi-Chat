import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  Modal, Dimensions, Linking, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { chats as chatsApi } from '../services/api';
import { API_URL } from '../config/api';

const { width } = Dimensions.get('window');
const IMG_SIZE = (width - 4) / 3;

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

function extractLinks(messages) {
  const links = [];
  messages.forEach(m => {
    if (m.type === 'text' && m.content) {
      const matches = m.content.match(URL_REGEX) || [];
      matches.forEach(url => {
        links.push({ id: `link-${m.id}-${url}`, url, content: m.content, createdAt: m.createdAt });
      });
    }
  });
  return links;
}

export default function MediaFileLinksScreen({ route, navigation }) {
  const { chatId, name } = route.params;
  const { colors, mode } = useTheme();
  const [tab, setTab] = useState('media');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const data = await chatsApi.getMessages(chatId, { limit: 500 });
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {} finally { setLoading(false); }
  }

  const mediaMessages = messages.filter(m => m.type === 'image');
  const fileMessages = messages.filter(m => m.type === 'file' || m.type === 'audio');
  const links = extractLinks(messages);

  const tabs = [
    { key: 'media', label: 'Media', count: mediaMessages.length },
    { key: 'file', label: 'File', count: fileMessages.length },
    { key: 'link', label: 'Tautan', count: links.length },
  ];

  function renderMedia({ item }) {
    return (
      <TouchableOpacity onPress={() => setPreviewImage(`${API_URL}${item.fileUrl}`)}>
        <Image source={{ uri: `${API_URL}${item.fileUrl}` }} style={styles.gridImage} />
      </TouchableOpacity>
    );
  }

  function renderFile({ item }) {
    const isAudio = item.type === 'audio';
    const icon = isAudio ? 'musical-notes' : 'document-attach';
    const url = `${API_URL}${item.fileUrl}`;
    return (
      <TouchableOpacity
        style={[styles.fileRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        onPress={() => Linking.openURL(url).catch(() => {})}
      >
        <View style={[styles.fileIcon, { backgroundColor: isAudio ? '#4A90D9' + '20' : colors.primary + '20' }]}>
          <Ionicons name={icon} size={22} color={isAudio ? '#4A90D9' : colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
            {item.fileName || (isAudio ? 'Pesan Suara' : 'File')}
          </Text>
          <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
            {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB · ` : ''}
            {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  function renderLink({ item }) {
    return (
      <TouchableOpacity
        style={[styles.linkRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        onPress={() => Linking.openURL(item.url).catch(() => {})}
      >
        <View style={[styles.linkIcon, { backgroundColor: '#FF6B6B20' }]}>
          <Ionicons name="link" size={20} color="#FF6B6B" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.linkUrl, { color: colors.primary }]} numberOfLines={1}>{item.url}</Text>
          <Text style={[styles.fileMeta, { color: colors.textSecondary }]} numberOfLines={1}>{item.content}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  function renderEmpty(tabKey) {
    const icons = { media: 'images-outline', file: 'document-outline', link: 'link-outline' };
    const labels = { media: 'Belum ada media', file: 'Belum ada file', link: 'Belum ada tautan' };
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={icons[tabKey]} size={52} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{labels[tabKey]}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Media, File & Tautan</Text>
          {name ? <Text style={styles.headerSub} numberOfLines={1}>{name}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: tab === t.key ? colors.primary : colors.textSecondary }]}>
              {t.label}
            </Text>
            {t.count > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.tabBadgeText}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : tab === 'media' ? (
        mediaMessages.length === 0 ? renderEmpty('media') : (
          <FlatList
            data={mediaMessages}
            keyExtractor={item => item.id}
            renderItem={renderMedia}
            numColumns={3}
            contentContainerStyle={{ padding: 1 }}
          />
        )
      ) : tab === 'file' ? (
        fileMessages.length === 0 ? renderEmpty('file') : (
          <FlatList
            data={fileMessages}
            keyExtractor={item => item.id}
            renderItem={renderFile}
          />
        )
      ) : (
        links.length === 0 ? renderEmpty('link') : (
          <FlatList
            data={links}
            keyExtractor={item => item.id}
            renderItem={renderLink}
          />
        )
      )}

      <Modal visible={!!previewImage} transparent onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 0.5,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6,
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10,
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 15 },
  gridImage: { width: IMG_SIZE, height: IMG_SIZE, margin: 1 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 0.5,
  },
  fileIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { fontSize: 12, marginTop: 2 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 0.5,
  },
  linkIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  linkUrl: { fontSize: 13, fontWeight: '600' },
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewImage: { width, height: width },
});
