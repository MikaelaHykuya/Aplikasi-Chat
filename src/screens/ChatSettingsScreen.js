import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, updateSettings } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const THEMES = ['System', 'Terang', 'Gelap'];
const FONT_SIZES = ['Kecil', 'Sedang', 'Besar'];
const CHAT_THEMES = [
  { key: 'Hijau', color: '#07C160' },
  { key: 'Biru', color: '#1a73e8' },
  { key: 'Ungu', color: '#9b59b6' },
  { key: 'Oranye', color: '#e67e22' },
  { key: 'Merah Muda', color: '#e91e8c' },
  { key: 'Merah', color: '#e53935' },
];

export default function ChatSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try { setSettings(await getSettings()); } catch {}
  }

  function cycleSetting(key, values) {
    const cur = settings[key] || values[0];
    const idx = values.indexOf(cur);
    const next = values[(idx + 1) % values.length];
    setSettings(prev => ({ ...prev, [key]: next }));
    updateSettings({ [key]: next }).catch(() => {});
  }

  function toggleSetting(key) {
    const next = !settings[key];
    setSettings(prev => ({ ...prev, [key]: next }));
    updateSettings({ [key]: next }).catch(() => {});
  }

  async function handleBackup() {
    navigation.navigate('BackupChat');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: colors.headerText }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Chat</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.body}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => cycleSetting('theme', THEMES)}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Tema</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{settings.theme || 'System'}</Text>
          </TouchableOpacity>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Tema Obrolan</Text>
            <View style={styles.chatThemeRow}>
              {CHAT_THEMES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => {
                    setSettings(prev => ({ ...prev, defaultChatTheme: t.key }));
                    updateSettings({ defaultChatTheme: t.key }).catch(() => {});
                  }}
                  style={[
                    styles.chatThemeDot,
                    { backgroundColor: t.color },
                    (settings.defaultChatTheme || 'Hijau') === t.key && styles.chatThemeDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => toggleSetting('enterToSend')}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Enter untuk Mengirim</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{settings.enterToSend ? 'Aktif' : 'Nonaktif'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => cycleSetting('mediaVisibility', ['Semua', 'Baru', 'Tidak Ada'])}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Visibilitas Media</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{settings.mediaVisibility || 'Semua'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => cycleSetting('fontSize', FONT_SIZES)}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Ukuran Font</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{settings.fontSize || 'Sedang'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Transkrip Pesan Suara</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Data & Penyimpanan</Text>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={handleBackup}>
            <Ionicons name="download-outline" size={20} color={colors.textSecondary} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Backup Chat (Ekspor JSON)</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </TouchableOpacity>
        </View>
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
  backBtn: { fontSize: 28, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  body: { flex: 1 },
  section: { marginTop: 16, borderTopWidth: 0.5, borderBottomWidth: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 14 },
  chatThemeRow: { flexDirection: 'row', gap: 8 },
  chatThemeDot: { width: 24, height: 24, borderRadius: 12 },
  chatThemeDotActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  rowIcon: { marginRight: 12 },
});
