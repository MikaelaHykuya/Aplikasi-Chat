import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { deleteAccount, updateSettings } from '../services/api';
import { setStorage } from '../services/storage';

export default function AccountScreen({ navigation }) {
  const { logout } = useAuth();
  const { colors } = useTheme();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  function handleDeleteAccount() {
    Alert.alert('Hapus Akun', 'Semua data akan hilang dan tidak bisa dikembalikan. Yakin?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => {
        Alert.alert('Konfirmasi', 'Ketik HAPUS untuk konfirmasi', [
          { text: 'Batal', style: 'cancel' },
          { text: 'HAPUS', style: 'destructive', onPress: async () => {
            try {
              await deleteAccount();
              logout();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }},
        ]);
      }},
    ]);
  }

  function handleSavePin() {
    if (pin.length < 4) { Alert.alert('', 'PIN minimal 4 digit'); return; }
    if (pin !== confirmPin) { Alert.alert('', 'PIN tidak cocok'); return; }
    Promise.all([
      updateSettings({ appLockPin: pin, appLock: true }),
      setStorage('appLockPin', pin),
    ]).then(() => {
      Alert.alert('', 'PIN berhasil disimpan');
      setShowPinSetup(false);
      setPin('');
      setConfirmPin('');
    }).catch(() => {});
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={26} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Akun</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#4A90D915' }]}>
              <Ionicons name="person-add-outline" size={22} color="#4A90D9" />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Tambah Akun</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => setShowPinSetup(!showPinSetup)}>
            <View style={[styles.iconWrap, { backgroundColor: '#FF6B6B15' }]}>
              <Ionicons name="key-outline" size={22} color="#FF6B6B" />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Kunci Sandi</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
        </View>

        {showPinSetup && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Atur PIN Kunci Aplikasi</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="PIN (4-6 digit)"
                placeholderTextColor={colors.textSecondary}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Konfirmasi PIN"
                placeholderTextColor={colors.textSecondary}
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePin}>
              <Text style={styles.saveBtnText}>Simpan PIN</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleDeleteAccount}>
            <View style={[styles.iconWrap, { backgroundColor: '#ff444415' }]}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
            </View>
            <Text style={[styles.rowLabel, { color: '#ff4444' }]}>Hapus Akun</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
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
  headerBack: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  body: { flex: 1 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 14, paddingHorizontal: 16, paddingTop: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowLabel: { flex: 1, fontSize: 16, color: '#333' },
  inputWrap: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 12,
    backgroundColor: '#fafafa', paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 12,
  },
  input: { paddingVertical: 13, fontSize: 15, color: '#333', textAlign: 'center', letterSpacing: 6 },
  saveBtn: {
    backgroundColor: '#07C160', borderRadius: 12, padding: 14,
    alignItems: 'center', marginHorizontal: 16, marginBottom: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
