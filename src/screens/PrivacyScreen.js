import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getSettings, updateSettings } from '../services/api';
import { getStorage, removeStorage } from '../services/storage';

const OPTIONS = ['Semua', 'Kontak Saya', 'Tidak Ada'];

export default function PrivacyScreen({ navigation }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try { setSettings(await getSettings()); } catch {}
  }

  function cycleSetting(key, values = OPTIONS) {
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

  async function toggleAppLock() {
    if (settings.appLock) {
      await removeStorage('appLockPin');
      toggleSetting('appLock');
    } else {
      const pin = await getStorage('appLockPin');
      if (!pin) {
        Alert.alert('', 'Atur PIN dulu di Akun > Kunci Sandi');
        return;
      }
      toggleSetting('appLock');
    }
  }

  function PrivacyRow({ label, value, onPress }) {
    return (
      <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value || 'Semua'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: colors.headerText }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Privasi</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.body}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PrivacyRow label="Terakhir Dilihat & Online" value={settings.lastSeen} onPress={() => cycleSetting('lastSeen')} />
          <PrivacyRow label="Foto Profil" value={settings.profilePhoto} onPress={() => cycleSetting('profilePhoto')} />
          <PrivacyRow label="Tentang" value={settings.about} onPress={() => cycleSetting('about')} />
          <PrivacyRow label="Tautan" value={settings.links} onPress={() => cycleSetting('links')} />
          <PrivacyRow label="Status" value={settings.statusPrivacy} onPress={() => cycleSetting('statusPrivacy')} />
          <PrivacyRow label="Laporan Dibaca" value={settings.readReceipts !== false ? 'Aktif' : 'Nonaktif'} onPress={() => toggleSetting('readReceipts')} />
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PrivacyRow label="Pesan Sementara" value={settings.disappearingMessages || 'Mati'} onPress={() => cycleSetting('disappearingMessages', ['Mati', '24 jam', '7 hari', '90 hari'])} />
          <PrivacyRow label="Timer Pesan Default" value={settings.defaultMessageTimer || 'Mati'} onPress={() => cycleSetting('defaultMessageTimer', ['Mati', '24 jam', '7 hari', '90 hari'])} />
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <PrivacyRow label="Grup" value={settings.groupPrivacy || 'Semua'} onPress={() => cycleSetting('groupPrivacy')} />
          <PrivacyRow label="Panggilan" value={settings.callPrivacy || 'Semua'} onPress={() => cycleSetting('callPrivacy')} />
          <PrivacyRow label="Kontak" value={settings.contactPrivacy || 'Semua'} onPress={() => cycleSetting('contactPrivacy')} />
          <PrivacyRow label="Kunci Aplikasi" value={settings.appLock ? 'Aktif' : 'Nonaktif'} onPress={toggleAppLock} />
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Stiker Avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Izinkan Efek Kamera</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{settings.allowCameraEffects ? 'Aktif' : 'Nonaktif'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
  },
  backBtn: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  body: { flex: 1 },
  section: { backgroundColor: '#fff', marginTop: 16, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#ddd' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  rowLabel: { fontSize: 16, color: '#333' },
  rowValue: { fontSize: 14, color: '#999' },
});
