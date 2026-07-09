import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, Dimensions, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/storage';
import { API_URL } from '../config/api';

export default function ViewStatusScreen({ route, navigation }) {
  const { group } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const statuses = group.statuses || [];
  const current = statuses[index];
  const isMine = group.user?.id === user?.id;

  const videoSource = current && current.type === 'video' && current.mediaUrl ? `${API_URL}${current.mediaUrl}` : null;

  useEffect(() => {
    startTimer();
    return () => clearTimeout(timerRef.current);
  }, [index]);

  function startTimer() {
    clearTimeout(timerRef.current);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(() => {
      if (index < statuses.length - 1) setIndex(index + 1);
      else navigation.goBack();
    }, 5000);
  }

  function handleTap(evt) {
    clearTimeout(timerRef.current);
    progressAnim.stopAnimation();
    const x = evt.nativeEvent.locationX;
    const width = Dimensions.get('window').width;
    if (x > width * 0.5) {
      if (index < statuses.length - 1) setIndex(index + 1);
      else navigation.goBack();
    } else {
      if (index > 0) setIndex(index - 1);
      else startTimer();
    }
  }

  async function handleDelete() {
    clearTimeout(timerRef.current);
    progressAnim.stopAnimation();
    Alert.alert('Hapus Status', 'Yakin ingin menghapus status ini?', [
      { text: 'Batal', style: 'cancel', onPress: () => startTimer() },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken();
          await fetch(`${API_URL}/api/status/${current.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          navigation.goBack();
        } catch (err) {
          Alert.alert('Error', 'Gagal menghapus status');
          startTimer();
        }
      }}
    ]);
  }

  if (!current) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B12" />
      
      <TouchableOpacity style={styles.touchArea} activeOpacity={1} onPress={handleTap}>
        {/* Background */}
        <LinearGradient
          colors={current.type === 'text' ? [colors.primaryDark, colors.primary] : ['#0B0B12', '#0B0B12']}
          style={StyleSheet.absoluteFillObject}
        />
        
        {current.type === 'text' && (
          <View style={[StyleSheet.absoluteFillObject, styles.textBgOverlay]} />
        )}

        {/* Content */}
        <View style={styles.content}>
          {current.type === 'image' && current.mediaUrl ? (
            <Image source={{ uri: `${API_URL}${current.mediaUrl}` }} style={styles.media} resizeMode="contain" />
          ) : current.type === 'video' && current.mediaUrl ? (
            <Video source={{ uri: videoSource }} style={styles.media} resizeMode="contain" shouldPlay isLooping useNativeControls={false} />
          ) : (
            <Text style={styles.statusText}>{current.content}</Text>
          )}
        </View>

        {/* Header Overlay */}
        <View style={styles.topBar}>
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.progressRow}>
            {statuses.map((_, i) => (
              <View key={i} style={[styles.progressBar, i < index && styles.progressActive]}>
                {i === index && (
                  <Animated.View style={[StyleSheet.absoluteFill, styles.progressActive, {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  }]} />
                )}
              </View>
            ))}
          </View>
          <View style={styles.userRow}>
            {group.user.avatar ? (
              <Image source={{ uri: `${API_URL}${group.user.avatar}` }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{group.user.displayName?.charAt(0).toUpperCase() || '?'}</Text>
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{group.user.displayName || group.user.username}</Text>
              <Text style={styles.timeText}>{new Date(current.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {isMine && (
              <TouchableOpacity onPress={handleDelete} style={[styles.closeBtn, { marginRight: 15 }]}>
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B12' },
  touchArea: { flex: 1 },
  textBgOverlay: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  topBar: { 
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24,
    zIndex: 10,
  },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  progressBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressActive: { backgroundColor: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  userName: { color: '#fff', fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  timeText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  closeBtn: { padding: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  media: { width: '100%', height: '100%' },
  statusText: { color: '#fff', fontSize: 32, textAlign: 'center', lineHeight: 44, fontWeight: '600' },
});
