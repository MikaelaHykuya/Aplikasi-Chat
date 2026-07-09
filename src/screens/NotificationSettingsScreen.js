import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { getSettings, updateSettings } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function NotificationSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try { setSettings(await getSettings()); } catch {}
  }

  function toggleSetting(key) {
    const next = !settings[key];
    setSettings(prev => ({ ...prev, [key]: next }));
    updateSettings({ [key]: next }).catch(() => {});
  }

  function NotifRow({ label, noBorder }) {
    return (
      <View style={[styles.notifRow, noBorder && { borderBottomWidth: 0 }, { borderBottomColor: colors.border }]}>
        <Text style={[styles.notifLabel, { color: colors.text }]}>{label}</Text>
      </View>
    );
  }

  function ToggleRow({ label, settingKey }) {
    const value = settings[settingKey];
    return (
      <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => toggleSetting(settingKey)}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value ? 'Aktif' : 'Nonaktif'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: colors.headerText }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Notifikasi</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.body}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow label="Nada Percakapan" settingKey="conversationTones" />
          <ToggleRow label="Pengingat" settingKey="reminders" />
        </View>

        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Pesan</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NotifRow label="Nada Notifikasi" />
          <ToggleRow label="Getar" settingKey="messageVibrate" />
          <ToggleRow label="Cahaya" settingKey="messageLight" />
          <ToggleRow label="Gunakan Notifikasi Prioritas" settingKey="messagePriority" noBorder />
          <ToggleRow label="Notifikasi Reaksi" settingKey="messageReactions" />
        </View>

        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Grup</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NotifRow label="Nada Notifikasi" />
          <ToggleRow label="Getar" settingKey="groupVibrate" />
          <ToggleRow label="Cahaya" settingKey="groupLight" />
          <ToggleRow label="Gunakan Notifikasi Prioritas" settingKey="groupPriority" noBorder />
          <ToggleRow label="Notifikasi Reaksi" settingKey="groupReactions" />
        </View>

        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Panggilan</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NotifRow label="Nada Dering" />
          <ToggleRow label="Getar" settingKey="callVibrate" />
        </View>

        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Status</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <NotifRow label="Nada Notifikasi" />
          <ToggleRow label="Getar" settingKey="statusVibrate" />
          <ToggleRow label="Gunakan Notifikasi Prioritas" settingKey="statusPriority" />
          <ToggleRow label="Reaksi" settingKey="statusReactions" noBorder />
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
  section: { borderTopWidth: 0.5, borderBottomWidth: 0.5 },
  sectionTitleWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 14 },
  notifRow: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  notifLabel: { fontSize: 16 },
});
