import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, Alert, Platform } from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import { useSocket } from '../context/SocketContext';

export default function CallScreen({ route, navigation }) {
  const { type, targetUser, direction, offer, autoAccept } = route.params;
  const { colors, mode } = useTheme();
  const { socket } = useSocket();

  const [duration, setDuration] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const peerConnectionRef = useRef(null);
  const candidateBufferRef = useRef([]);
  const soundRef = useRef(null);

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
          soundRef.current = sound;
        } catch (e) {
          console.log('Audio init err:', e);
        }
      }
    }
    initSound();
    return () => {
      if (currentSound) currentSound.unloadAsync();
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [direction, callActive, callEnded, autoAccept]);

  // WebRTC Setup
  useEffect(() => {
    let isMounted = true;
    
    const configuration = { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, 
        { urls: 'stun:stun1.l.google.com:19302' }
      ] 
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call:candidate', { targetId: targetUser?.id, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    const startCall = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video' ? { facingMode: 'user' } : false
        });
        
        if (!isMounted) return;
        setLocalStream(stream);

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        if (direction === 'outgoing') {
          const localOffer = await pc.createOffer();
          await pc.setLocalDescription(localOffer);
          socket?.emit('call:offer', { targetId: targetUser?.id, type, offer: localOffer });
        } else if (direction === 'incoming' && autoAccept && offer) {
          handleOffer(offer);
        }
      } catch (err) {
        Alert.alert('WebRTC Error', 'Gagal mengakses kamera/mikrofon: ' + err.message);
        handleEnd();
      }
    };

    startCall();

    return () => {
      isMounted = false;
      pc.close();
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []); // Run once on mount

  const handleOffer = async (receivedOffer) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      setCallActive(true);
      await pc.setRemoteDescription(new RTCSessionDescription(receivedOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('call:answer', { callerId: targetUser?.id, answer });
      
      // Flush buffered candidates
      candidateBufferRef.current.forEach(cand => {
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.log);
      });
      candidateBufferRef.current = [];
    } catch (err) {
      Alert.alert('WebRTC Error', 'Gagal memproses panggilan: ' + err.message);
    }
  };

  useEffect(() => {
    if (!socket) return;
    
    const onAnswered = async (data) => {
      setCallActive(true);
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          candidateBufferRef.current.forEach(cand => {
            pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.log);
          });
          candidateBufferRef.current = [];
        } catch (err) {
          console.log('Error setting remote answer:', err);
        }
      }
    };

    const onCandidate = async (data) => {
      const pc = peerConnectionRef.current;
      if (pc) {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.log);
        } else {
          candidateBufferRef.current.push(data.candidate);
        }
      }
    };

    const onEnded = () => {
      setCallActive(false);
      setCallEnded(true);
      setTimeout(() => navigation.goBack(), 1500);
    };

    const onError = (data) => {
      Alert.alert('Panggilan Gagal', data.message || 'Pengguna tidak dapat dihubungi');
      handleEnd();
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:candidate', onCandidate);
    socket.on('call:ended', onEnded);
    socket.on('call:error', onError);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:candidate', onCandidate);
      socket.off('call:ended', onEnded);
      socket.off('call:error', onError);
    };
  }, [socket]);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  function handleEnd() {
    socket?.emit('call:end', { targetId: targetUser?.id, duration, type });
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    navigation.goBack();
  }

  function handleAccept() {
    if (!offer) {
       Alert.alert('Error', 'Data panggilan (offer) hilang!');
       return;
    }
    handleOffer(offer);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      
      {/* Remote Video */}
      {type === 'video' && remoteStream && callActive && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
        />
      )}

      {/* Local Video Picture-in-Picture */}
      {type === 'video' && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          zOrder={1}
          mirror={true}
        />
      )}

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
  localVideo: {
    width: 110,
    height: 150,
    position: 'absolute',
    bottom: 120,
    right: 20,
    zIndex: 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#222',
    overflow: 'hidden'
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
