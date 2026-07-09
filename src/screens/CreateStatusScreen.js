import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../context/ThemeContext';
import { getToken } from '../services/storage';
import { API_URL } from '../config/api';

export default function CreateStatusScreen({ navigation }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [media, setMedia] = useState(null);
  const { colors } = useTheme();

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia(result.assets[0]);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin diperlukan', 'Izinkan akses kamera'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setMedia(result.assets[0]);
    }
  }

  async function handleCreate() {
    if (!text.trim() && !media) { Alert.alert('Oops', 'Tulis teks atau pilih gambar untuk status Anda'); return; }
    setSending(true);
    try {
      const token = await getToken();
      let mediaUrl = null;
      if (media) {
        const uploadRes = await FileSystem.uploadAsync(`${API_URL}/api/upload`, media.uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType?.MULTIPART || FileSystem.UploadType?.MULTIPART || 1,
          fieldName: 'file',
          mimeType: media.mimeType || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          headers: { Authorization: `Bearer ${token}` }
        });
        const uploadData = JSON.parse(uploadRes.body);
        if (uploadRes.status !== 200) throw new Error(uploadData.error || 'Gagal upload media');
        mediaUrl = uploadData.url;
      }
      const res = await fetch(`${API_URL}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim() || (media?.type === 'video' ? 'Video' : 'Foto'), type: media ? (media.type === 'video' ? 'video' : 'image') : 'text', mediaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat status');
      navigation.goBack();
    } catch (err) {
      console.log('Error creating status:', err);
      Alert.alert('Gagal', err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header gradient */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Status Baru</Text>
          <TouchableOpacity onPress={handleCreate} disabled={sending} style={[styles.sendBtn, sending && { opacity: 0.7 }]}>
            {sending ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={[styles.sendBtnText, { color: colors.primary }]}>Bagikan</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <TextInput
          style={[styles.input, { color: colors.text, fontSize: text.length < 50 && !media ? 28 : 18 }]}
          placeholder="Apa yang sedang terjadi?"
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholderTextColor={colors.textTertiary}
          textAlignVertical="top"
        />

        {media && (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: media.uri }} style={styles.mediaPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setMedia(null)}>
              <Ionicons name="close-circle" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.borderLight }]}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '18' }]} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '18' }]} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    minWidth: 80,
  },
  sendBtnText: { fontSize: 14, fontWeight: '800' },
  body: { flex: 1, padding: 24 },
  input: { flex: 1, fontWeight: '500', minHeight: 120 },
  mediaPreviewContainer: {
    width: '100%', height: 280, marginTop: 16,
    borderRadius: 24, overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  mediaPreview: { width: '100%', height: '100%' },
  removeMediaBtn: {
    position: 'absolute', top: 12, right: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1,
  },
  actionBtn: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
});
