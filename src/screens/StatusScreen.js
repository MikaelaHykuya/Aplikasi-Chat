import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import { getToken } from '../services/storage';

export default function StatusScreen({ navigation }) {
  const { colors, mode } = useTheme();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    loadStatuses();
  }, []));

  async function loadStatuses() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/status/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroups(data || []);
    } catch (err) {
      console.log('Error loading statuses:', err);
    } finally {
      setLoading(false);
    }
  }

  const myStatuses = groups.filter(g => g.user.id === user?.id);
  const friendStatuses = groups.filter(g => g.user.id !== user?.id);

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m`;
    if (hours < 24) return `${hours}j`;
    return date.toLocaleDateString('id-ID', { weekday: 'short' });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header gradient */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Status</Text>
      </LinearGradient>

      <FlatList
        data={friendStatuses}
        keyExtractor={(item) => item.user.id}
        ListHeaderComponent={
          <View>
            <View style={[styles.myStatusRow, { backgroundColor: colors.card }]}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => myStatuses.length > 0 ? navigation.navigate('ViewStatus', { group: myStatuses[0] }) : navigation.navigate('CreateStatus')}
              >
                <View style={styles.myAvatarWrap}>
                  {user?.avatar ? (
                    <Image source={{ uri: `${API_URL}${user.avatar}` }} style={[styles.avatar, myStatuses.length > 0 && { borderWidth: 2, borderColor: colors.primary }]} />
                  ) : (
                    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  {myStatuses.length === 0 && (
                    <View style={[styles.addBadge, { borderColor: colors.card, backgroundColor: colors.primary }]}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusName, { color: colors.text }]}>Status saya</Text>
                  <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>
                    {myStatuses.length > 0 ? 'Ketuk untuk lihat status' : 'Tambahkan status'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.createBtn, { backgroundColor: colors.primary + '18' }]}
                onPress={() => navigation.navigate('CreateStatus')}
              >
                <Ionicons name="camera" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sectionDivider}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PEMBARUAN TERKINI</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.statusRow, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]} onPress={() => navigation.navigate('ViewStatus', { group: item })}>
            <View style={[styles.statusRing, { borderColor: colors.primary }]}>
              {item.user.avatar ? (
                <Image source={{ uri: `${API_URL}${item.user.avatar}` }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                  <Text style={styles.avatarLetter}>{item.user.displayName?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusName, { color: colors.text }]}>{item.user.displayName || item.user.username}</Text>
              <Text style={[styles.statusMeta, { color: colors.textSecondary }]}>{formatTime(item.statuses[0]?.createdAt)} yang lalu</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <LinearGradient colors={[colors.primary + '18', colors.accentTeal + '10']} style={styles.emptyIconBg}>
                <Ionicons name="time-outline" size={44} color={colors.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Belum ada status terbaru</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Pembaruan status dari kontak Anda akan muncul di sini</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={loadStatuses}
        contentContainerStyle={friendStatuses.length === 0 && !loading ? { flexGrow: 1 } : { paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 58, paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  myStatusRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    marginHorizontal: 16, marginTop: 16, borderRadius: 20,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  myAvatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  addBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 24, height: 24,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
  },
  createBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionDivider: {
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.8,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 20,
    borderBottomWidth: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statusRing: {
    width: 62, height: 62, borderRadius: 31, borderWidth: 2.5,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  statusName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  statusMeta: { fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconBg: {
    width: 90, height: 90, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
