import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getToken } from '../services/storage';
import { API_URL } from '../config/api';

export default function CallsScreen({ navigation }) {
  const { colors } = useTheme();
  const [calls, setCalls] = useState([]);

  useFocusEffect(useCallback(() => {
    loadCalls();
  }, []));

  async function loadCalls() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/calls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCalls(data || []);
    } catch {}
  }

  function formatDuration(s) {
    if (!s || s === 0) return 'tidak terjawab';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function getCallIcon(item) {
    if (item.status === 'missed') return { name: 'call', color: '#ff4444', bg: '#fff0f0' };
    if (item.direction === 'outgoing') return { name: 'call-outline', color: '#07C160', bg: '#f0fff4' };
    return { name: 'call', color: '#07C160', bg: '#f0fff4' };
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: colors.primary }]}>
        <Text style={s.headerTitle}>Panggilan</Text>
      </View>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="call-outline" size={40} color={colors.textSecondary} />
            </View>
            <Text style={s.emptyTitle}>Belum ada panggilan</Text>
            <Text style={s.emptySub}>Panggilan suara dan video akan muncul di sini</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = getCallIcon(item);
          const missed = item.status === 'missed';
          return (
            <View style={s.callRow}>
              <View style={[s.avatarCircle, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name} size={22} color={icon.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.callName, missed && s.callNameMissed]}>{item.otherName || 'Tidak diketahui'}</Text>
                <View style={s.callMetaRow}>
                  <Ionicons
                    name={missed ? 'arrow-down' : item.direction === 'outgoing' ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={missed ? '#ff4444' : colors.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[s.callMeta, missed && s.callMetaMissed]}>
                    {item.type === 'video' ? 'Panggilan video' : 'Panggilan suara'} • {formatDuration(item.duration)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={s.callBtn}>
                <Ionicons name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: colors.headerText, letterSpacing: 0.3 },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  callRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  callName: { fontSize: 16, fontWeight: '600', color: colors.text },
  callNameMissed: { color: '#ff4444' },
  callMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  callMeta: { fontSize: 13, color: colors.textSecondary },
  callMetaMissed: { color: '#ff4444' },
  callBtn: { padding: 8 },
});
