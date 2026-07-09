import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Dimensions, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors, mode } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleLogin() {
    if (!username || !password) {
      shake();
      Alert.alert('Oops!', 'Username dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      shake();
      Alert.alert('Login Gagal', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Full gradient background */}
      <LinearGradient
        colors={['#6C63FF', '#4ECDC4', '#44A1E0']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative circles */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={styles.logoGlass}>
          <Text style={styles.logoChar}>Z</Text>
        </View>
        <Text style={styles.appName}>Zentro</Text>
        <Text style={styles.tagline}>Ajak teman, ngobrol seru ✨</Text>
      </View>

      {/* Form card */}
      <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.cardTitle}>Masuk ke akun</Text>

        {/* Username */}
        <View style={[
          styles.inputWrap,
          focused === 'username' && styles.inputWrapFocused
        ]}>
          <Ionicons name="person-outline" size={18} color={focused === 'username' ? '#6C63FF' : '#B0B0BA'} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Username atau Email"
            placeholderTextColor="#B0B0BA"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
          />
        </View>

        {/* Password */}
        <View style={[
          styles.inputWrap,
          focused === 'password' && styles.inputWrapFocused
        ]}>
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

        {/* Login button */}
        <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={styles.btnWrap}>
          <LinearGradient
            colors={['#6C63FF', '#4ECDC4']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Masuk →</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
          <Text style={styles.linkText}>
            Belum punya akun? <Text style={styles.linkAccent}>Daftar sekarang</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  circle1: {
    position: 'absolute', width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -W * 0.2, right: -W * 0.15,
  },
  circle2: {
    position: 'absolute', width: W * 0.5, height: W * 0.5, borderRadius: W * 0.25,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: H * 0.28, left: -W * 0.15,
  },
  logoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  logoGlass: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  logoChar: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  appName: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.2 },
  card: {
    marginHorizontal: 20,
    marginBottom: 36,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 24, letterSpacing: -0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EBEBF0', borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 14, backgroundColor: '#F8F8FC',
  },
  inputWrapFocused: { borderColor: '#6C63FF', backgroundColor: '#F4F3FF' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1A1A2E' },
  eyeBtn: { padding: 4 },
  btnWrap: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  btn: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  linkWrap: { alignItems: 'center', marginTop: 20 },
  linkText: { fontSize: 14, color: '#8E8E9A' },
  linkAccent: { color: '#6C63FF', fontWeight: '700' },
});
