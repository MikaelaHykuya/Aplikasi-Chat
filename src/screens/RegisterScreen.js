import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width: W } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [focused, setFocused] = useState(null);

  async function handleRegister() {
    if (!username || !email || !password) {
      Alert.alert('Oops!', 'Username, email, dan password wajib diisi');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Oops!', 'Password tidak cocok');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Oops!', 'Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password, displayName);
    } catch (err) {
      Alert.alert('Daftar Gagal', err.message);
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { key: 'username', placeholder: 'Username', icon: 'person-outline', value: username, onChange: setUsername, autoCapitalize: 'none' },
    { key: 'email', placeholder: 'Email', icon: 'mail-outline', value: email, onChange: setEmail, autoCapitalize: 'none', keyboardType: 'email-address' },
    { key: 'displayName', placeholder: 'Nama Tampilan (opsional)', icon: 'sparkles-outline', value: displayName, onChange: setDisplayName },
  ];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#6C63FF', '#4ECDC4', '#44A1E0']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoGlass}>
            <Text style={styles.logoChar}>Z</Text>
          </View>
          <Text style={styles.appName}>Bergabung Sekarang</Text>
          <Text style={styles.tagline}>Buat akun Zentro kamu 🚀</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Buat akun baru</Text>

          {fields.map(f => (
            <View key={f.key} style={[styles.inputWrap, focused === f.key && styles.inputWrapFocused]}>
              <Ionicons name={f.icon} size={18} color={focused === f.key ? '#6C63FF' : '#B0B0BA'} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                placeholderTextColor="#B0B0BA"
                value={f.value}
                onChangeText={f.onChange}
                autoCapitalize={f.autoCapitalize || 'words'}
                keyboardType={f.keyboardType}
                onFocus={() => setFocused(f.key)}
                onBlur={() => setFocused(null)}
              />
            </View>
          ))}

          {/* Password */}
          <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? '#6C63FF' : '#B0B0BA'} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#B0B0BA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#B0B0BA" />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={[styles.inputWrap, focused === 'confirm' && styles.inputWrapFocused]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={focused === 'confirm' ? '#6C63FF' : '#B0B0BA'} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Konfirmasi Password"
              placeholderTextColor="#B0B0BA"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPw}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
              <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#B0B0BA" />
            </TouchableOpacity>
          </View>

          {/* Register button */}
          <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={styles.btnWrap}>
            <LinearGradient
              colors={['#6C63FF', '#4ECDC4']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Buat Akun →</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              Sudah punya akun? <Text style={styles.linkAccent}>Masuk</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 20 },
  circle1: {
    position: 'absolute', width: W * 0.6, height: W * 0.6, borderRadius: W * 0.3,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -W * 0.15, right: -W * 0.1,
  },
  circle2: {
    position: 'absolute', width: W * 0.4, height: W * 0.4, borderRadius: W * 0.2,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 100, left: -W * 0.1,
  },
  logoArea: { alignItems: 'center', paddingTop: 70, paddingBottom: 10 },
  logoGlass: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  logoChar: { fontSize: 38, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 26, fontWeight: '900', color: '#fff' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: '#fff', borderRadius: 28, padding: 26,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 28, elevation: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 20, letterSpacing: -0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EBEBF0', borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#F8F8FC',
  },
  inputWrapFocused: { borderColor: '#6C63FF', backgroundColor: '#F4F3FF' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#1A1A2E' },
  eyeBtn: { padding: 4 },
  btnWrap: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  linkWrap: { alignItems: 'center', marginTop: 18 },
  linkText: { fontSize: 14, color: '#8E8E9A' },
  linkAccent: { color: '#6C63FF', fontWeight: '700' },
});
