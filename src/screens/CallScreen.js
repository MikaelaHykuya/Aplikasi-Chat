import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import { useSocket } from '../context/SocketContext';

export default function CallScreen({ route, navigation }) {
  const { type, targetUser, direction } = route.params;
  const { colors } = useTheme();
  const { socket } = useSocket();
  const [duration, setDuration] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    if (!socket) return;

    if (direction === 'outgoing') {
      socket.emit('call:offer', { targetId: targetUser?.id, type, offer: 'dummy' });
    }

    const onAnswered = () => setCallActive(true);
    const onEnded = () => {
      setCallActive(false);
      setCallEnded(true);
      setTimeout(() => navigation.goBack(), 1500);
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:ended', onEnded);
    };
  }, [socket, direction, targetUser]);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  function handleEnd() {
    socket?.emit('call:end', { targetId: targetUser?.id, duration, type });
    navigation.goBack();
  }

  function handleAccept() {
    socket?.emit('call:answer', { callerId: targetUser?.id, answer: true });
    setCallActive(true);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <View style={styles.bg}>
        <View style={styles.content}>
          {targetUser?.avatar ? (
            <Image source={{ uri: `${API_URL}${targetUser.avatar}` }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarLetter}>{(targetUser?.displayName || targetUser?.username || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{targetUser?.displayName || targetUser?.username || 'Pengguna'}</Text>
          <Text style={styles.status}>
            {callEnded
              ? 'Panggilan Berakhir'
              : direction === 'incoming' && !callActive
                ? 'Panggilan masuk...'
                : callActive
                  ? formatTime(duration)
                  : 'Memanggil...'}
          </Text>
          {type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={styles.videoBadgeText}>Video</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {direction === 'incoming' && !callActive ? (
            <>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleEnd}>
                <Ionicons name="close" size={30} color="#fff" />
                <Text style={styles.actionLabel}>Tolak</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Ionicons name="checkmark" size={30} color="#fff" />
                <Text style={styles.actionLabel}>Terima</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
              <Ionicons name="close" size={30} color="#fff" />
              <Text style={styles.actionLabel}>Akhiri</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
    bg: { flex: 1, justifyContent: 'space-between', backgroundColor: '#0d0d0d' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  avatar: {
    width: 130, height: 130, borderRadius: 65, marginBottom: 24,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarPlaceholder: {
    width: 130, height: 130, borderRadius: 65,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarLetter: { color: '#fff', fontSize: 52, fontWeight: 'bold' },
  name: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  status: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  videoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
  },
  videoBadgeText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  actions: {
    flexDirection: 'row', justifyContent: 'center', gap: 56,
    paddingBottom: 64,
  },
  endBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#ff4444',
    justifyContent: 'center', alignItems: 'center',
  },
  rejectBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#ff4444',
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#07C160',
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 12, marginTop: 6, textAlign: 'center' },
});
