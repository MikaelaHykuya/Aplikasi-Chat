import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, Alert } from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function CallScreen({ route, navigation }) {
  const { type, targetUser, direction, offer, autoAccept } = route.params;
  const { colors } = useTheme();
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const pc = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [duration, setDuration] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    let currentSound;
    async function initSound() {
      if (direction === 'incoming' && !callActive && !callEnded && !autoAccept) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: 'https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg' },
            { shouldPlay: true, isLooping: true }
          );
          currentSound = sound;
        } catch (e) {}
      }
    }
    initSound();
    return () => {
      if (currentSound) currentSound.unloadAsync();
    };
  }, [direction, callActive, callEnded]);

  useEffect(() => {
    let isSubscribed = true;
    let localStreamRef = null;

    async function startCall() {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video' ? { facingMode: 'user' } : false
        });
        if (!isSubscribed) return;
        setLocalStream(stream);
        localStreamRef = stream;

        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const peerConnection = new RTCPeerConnection(configuration);
        pc.current = peerConnection;

        peerConnection.addStream(stream);

        peerConnection.onaddstream = (event) => {
          if (isSubscribed) setRemoteStream(event.stream);
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.emit('call:candidate', { targetId: targetUser?.id, candidate: event.candidate });
          }
        };

        if (direction === 'outgoing') {
          const localOffer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(localOffer);
          socket?.emit('call:offer', { targetId: targetUser?.id, type, offer: localOffer });
        } else if (direction === 'incoming' && autoAccept && offer) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket?.emit('call:answer', { callerId: targetUser?.id, answer });
          setCallActive(true);
        }
      } catch (err) {
        console.error('WebRTC Init Error:', err);
        Alert.alert('WebRTC Error', err.toString());
      }
    }

    startCall();

    return () => {
      isSubscribed = false;
      if (pc.current) pc.current.close();
      if (localStreamRef) localStreamRef.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onAnswered = async (data) => {
      setCallActive(true);
      if (pc.current) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const onCandidate = async (data) => {
      if (pc.current) {
        await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    const onEnded = () => {
      setCallActive(false);
      setCallEnded(true);
      setTimeout(() => navigation.goBack(), 1500);
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:candidate', onCandidate);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:candidate', onCandidate);
      socket.off('call:ended', onEnded);
    };
  }, [socket]);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  function handleEnd() {
    socket?.emit('call:end', { targetId: targetUser?.id, duration, type });
    navigation.goBack();
  }

  async function handleAccept() {
    if (offer && pc.current) {
      try {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket?.emit('call:answer', { callerId: targetUser?.id, answer });
        setCallActive(true);
      } catch (err) {
        console.error('Accept Error:', err);
        Alert.alert('Error', err.toString());
      }
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <View style={styles.videoContainer}>
        {type === 'video' && remoteStream && (
          <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFillObject} objectFit="cover" />
        )}
        {type === 'video' && localStream && (
          <View style={styles.localVideoContainer}>
            <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFillObject} objectFit="cover" />
          </View>
        )}
      </View>
      
      <View style={[styles.bg, type === 'video' ? { backgroundColor: 'rgba(0,0,0,0.4)' } : {}]} pointerEvents="box-none">
        <View style={styles.content} pointerEvents="none">
          {(!callActive || type === 'voice') && (
            <>
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
                  : direction === 'incoming' && !callActive && !autoAccept
                    ? 'Panggilan masuk...'
                    : callActive || autoAccept
                      ? formatTime(duration)
                      : 'Memanggil...'}
              </Text>
            </>
          )}
          {type === 'video' && !callActive && !autoAccept && (
            <View style={styles.videoBadge}>
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={styles.videoBadgeText}>Video</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {direction === 'incoming' && !callActive && !autoAccept ? (
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
  videoContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000' },
  localVideoContainer: {
    width: 110, height: 150, position: 'absolute', bottom: 120, right: 20,
    borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden', backgroundColor: '#222', zIndex: 10
  },
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
