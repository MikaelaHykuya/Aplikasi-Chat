import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, ScrollView, StyleSheet, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { users as usersApi, upload as uploadApi, updateAvatar, backup as backupApi } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const { colors, mode } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(null);

  async function handleSave() {
    setSaving(true);
    try {
      await usersApi.updateProfile({ displayName, bio });
      await updateUser({ displayName, bio });
      Alert.alert('✅ Tersimpan', 'Profil berhasil diperbarui');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const uploaded = await uploadApi.file(result.assets[0].uri, 'avatar.jpg', 'image/jpeg');
      await updateAvatar(uploaded.url);
      await updateUser({ avatar: uploaded.url });
      Alert.alert('✅ Berhasil', 'Foto profil diperbarui');
    } catch (err) {
      Alert.alert('Error', err.message || 'Gagal upload foto profil');
    }
  }

  async function handleLogout() {
    Alert.alert('Keluar', 'Yakin ingin keluar dari Zentro?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  }

  async function handleBackup() {
    try {
      const data = await backupApi.getBackup();
      const fileUri = FileSystem.documentDirectory + 'zentro_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Info', 'Fitur berbagi tidak tersedia di perangkat ini');
      }
    } catch (err) {
      Alert.alert('Gagal Backup', err.message);
    }
  }

  async function handleRestore() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (res.canceled || !res.assets[0]) return;
      
      const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const data = JSON.parse(content);
      
      if (!data.chats || !data.messages) throw new Error('Format file tidak valid');

      Alert.alert('Restore Data', `Ditemukan ${data.chats.length} obrolan. Mulai memulihkan?`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Restore', onPress: async () => {
          try {
            await backupApi.restoreBackup(data);
            Alert.alert('✅ Berhasil', 'Semua chat berhasil dipulihkan');
          } catch (e) {
            Alert.alert('Gagal', e.message);
          }
        }}
      ]);
    } catch (err) {
      Alert.alert('Gagal Restore', err.message);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Gradient header + avatar hero */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.hero}
      >
        <View style={styles.heroNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Profil</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarArea}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap}>
            {user?.avatar ? (
              <Image source={{ uri: `${API_URL}${user.avatar}` }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Ketuk untuk ganti foto</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="at-outline" size={16} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>@{user?.username}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: '#FF9F4318' }]}>
              <Ionicons name="mail-outline" size={16} color="#FF9F43" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Edit card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Edit Profil</Text>

          <View style={[styles.inputWrap, {
            backgroundColor: colors.inputBg,
            borderColor: focused === 'name' ? colors.primary : colors.inputBorder,
          }]}>
            <Ionicons name="person-outline" size={17} color={focused === 'name' ? colors.primary : colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Nama Tampilan"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <View style={[styles.inputWrap, styles.textAreaWrap, {
            backgroundColor: colors.inputBg,
            borderColor: focused === 'bio' ? colors.primary : colors.inputBorder,
          }]}>
            <Ionicons name="create-outline" size={17} color={focused === 'bio' ? colors.primary : colors.textSecondary} style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 14 }]} />
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text }]}
              placeholder="Bio (ceritakan tentang dirimu)"
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              onFocus={() => setFocused('bio')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={styles.saveWrap}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                  </>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Backup & Restore */}
        <View style={[styles.card, { backgroundColor: colors.card, marginTop: 12 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Data & Penyimpanan</Text>
          
          <TouchableOpacity onPress={handleBackup} style={[styles.actionBtn, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Backup Obrolan (Ekspor)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleRestore} style={[styles.actionBtn, { backgroundColor: colors.primary + '18', marginTop: 10 }]}>
            <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Restore Obrolan (Impor)</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: '#FF4757' + '30' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#FF4757" />
          <Text style={styles.logoutText}>Keluar dari Zentro</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingBottom: 32,
  },
  heroNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, marginBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  avatarArea: { alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 100, height: 100, borderRadius: 30,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 40, fontWeight: '900' },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 8, fontWeight: '500' },
  body: { flex: 1, marginTop: -16 },
  card: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: Platform.OS === 'ios' ? 12 : 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0 : 0.06, shadowRadius: 10, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16, letterSpacing: -0.2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  divider: { height: 0.5, marginVertical: 4, marginLeft: 46 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  textAreaWrap: { alignItems: 'flex-start' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },
  textArea: { height: 72, textAlignVertical: 'top', paddingTop: 13 },
  saveWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: 14,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionText: { fontSize: 15, fontWeight: '600', marginLeft: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 16, padding: 15, borderRadius: 16, borderWidth: 1.5, gap: 8,
  },
  logoutText: { color: '#FF4757', fontSize: 16, fontWeight: '700' },
});
