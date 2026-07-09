import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getStorage, removeStorage } from '../services/storage';

export default function PinLockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const { colors } = useTheme();
  const { logout } = useAuth();

  async function handleSubmit() {
    const saved = await getStorage('appLockPin');
    if (pin === saved) {
      onUnlock();
    } else {
      Alert.alert('', 'PIN salah');
      setPin('');
    }
  }

  async function handleLogout() {
    await removeStorage('appLockPin');
    logout();
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      <View style={[styles.gradient, { backgroundColor: colors.primary }]}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>Kunci Aplikasi</Text>
        <Text style={styles.subtitle}>Masukkan PIN untuk membuka</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="••••"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
          <Text style={styles.btnText}>Buka</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 32 },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14,
    width: '100%', paddingHorizontal: 16, marginBottom: 20,
  },
  input: {
    paddingVertical: 16, fontSize: 22, color: '#fff', textAlign: 'center',
    letterSpacing: 12,
  },
  btn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%',
    alignItems: 'center', marginBottom: 20,
  },
  btnText: { color: '#07C160', fontWeight: '700', fontSize: 17 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
