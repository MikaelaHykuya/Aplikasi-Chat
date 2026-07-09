import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, Modal, Linking, Dimensions, TouchableWithoutFeedback
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { chats as chatsApi, upload as uploadApi, getSettings } from '../services/api';
import { onSettingsChange } from '../services/storage';
import { API_URL } from '../config/api';

const CHAT_THEME_COLORS = {
  Hijau: { bubbleSelf: '#07C160', bubbleSelfText: '#fff' },
  Biru: { bubbleSelf: '#1a73e8', bubbleSelfText: '#fff' },
  Ungu: { bubbleSelf: '#9b59b6', bubbleSelfText: '#fff' },
  Oranye: { bubbleSelf: '#e67e22', bubbleSelfText: '#fff' },
  'Merah Muda': { bubbleSelf: '#e91e8c', bubbleSelfText: '#fff' },
  Merah: { bubbleSelf: '#e53935', bubbleSelfText: '#fff' },
};

let recording = null;

function formatDateSeparator(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Hari ini';
  if (msgDate.getTime() === yesterday.getTime()) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ChatScreen({ route, navigation }) {
  const { chatId, chat: chatData } = route.params;
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { colors, mode } = useTheme();
  const [chat, setChat] = useState(chatData || {});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [recordingState, setRecordingState] = useState('idle');
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioProgress, setAudioProgress] = useState({});
  const [showAttach, setShowAttach] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [settings, setSettings] = useState({});
  const [reactTarget, setReactTarget] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [allChats, setAllChats] = useState([]);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);
  const soundRef = useRef(null);

  const otherMember = chat.members?.find(m => m.id !== user?.id);
  const chatName = chat.type === 'group' ? chat.name : (otherMember?.displayName || 'Chat');
  const otherUserId = otherMember?.id;
  const isGroupAdmin = chat.members?.find(m => m.id === user?.id)?.role === 'admin';
  const myRole = chat.members?.find(m => m.id === user?.id)?.role;
  const canSend = chat.type !== 'group' || !chat.sendPermission || chat.sendPermission === 'all' || myRole === 'admin';
  const FONT_SIZES = { Kecil: 13, Sedang: 15, Besar: 17 };
  const chatFontSize = FONT_SIZES[settings.fontSize] || 15;
  const chatThemeColors = CHAT_THEME_COLORS[settings.defaultChatTheme] || {};
  const bubbleSelfColor = chatThemeColors.bubbleSelf || colors.bubbleSelf;
  const bubbleSelfTextColor = chatThemeColors.bubbleSelfText || colors.bubbleSelfText;

  const isOtherOnline = chat.type === 'direct' && otherUserId && onlineUsers[otherUserId] === 'online';

  const displayItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < messages.length; i++) {
      const prev = messages[i - 1];
      if (!prev || new Date(messages[i].createdAt).toDateString() !== new Date(prev.createdAt).toDateString()) {
        items.push({ id: `date-sep-${i}`, type: 'date-separator', date: new Date(messages[i].createdAt) });
      }
      items.push(messages[i]);
    }
    return items;
  }, [messages]);

  useEffect(() => {
    loadMessages();
    loadChat();
    getSettings().then(setSettings).catch(() => {});
  }, [chatId]);

  useEffect(() => {
    return onSettingsChange((s) => setSettings({ ...s }));
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (msg) => {
      if (msg.chatId === chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('message:typing', ({ chatId: cId, userId: uId, isTyping }) => {
      if (cId === chatId && uId !== user?.id) {
        setTypingUsers(prev => {
          if (isTyping) return { ...prev, [uId]: true };
          const { [uId]: _, ...rest } = prev;
          return rest;
        });
      }
    });

    socket.on('message:edited', ({ messageId, content }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited: 1 } : m));
    });

    socket.on('message:reacted', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    return () => {
      socket.off('message:new');
      socket.off('message:typing');
      socket.off('message:edited');
      socket.off('message:reacted');
    };
  }, [socket, chatId, user?.id]);

  useEffect(() => {
    if (!socket) return;
    const onMessageDeleted = (data) => {
      if (data.chatId === chatId) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, content: data.content, type: data.type, fileUrl: null } : m));
      }
    };
    socket.on('message:deleted', onMessageDeleted);
    return () => socket.off('message:deleted', onMessageDeleted);
  }, [socket, chatId]);

  useEffect(() => {
    if (messages.length > 0) {
      const unreadIds = messages
        .filter(m => m.senderId !== user?.id && !m.readBy?.includes(user?.id))
        .map(m => m.id);
      if (unreadIds.length > 0) {
        chatsApi.markRead(chatId, unreadIds);
      }
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  async function loadMessages() {
    try {
      const data = await chatsApi.getMessages(chatId);
      setMessages(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChat() {
    try {
      const data = await chatsApi.getById(chatId);
      setChat(data);
    } catch (err) { }
  }

  function handleTyping(text) {
    setText(text);
    if (socket) {
      socket.emit('message:typing', { chatId, isTyping: text.length > 0 });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('message:typing', { chatId, isTyping: false });
      }, 2000);
    }
  }

  async function sendMessage(content, type = 'text', fileData = null) {
    if (!socket) {
      Alert.alert('Error', 'Koneksi terputus');
      return;
    }

    setSending(true);
    const payload = { chatId, content, type, ...fileData };
    if (replyTo) payload.replyTo = replyTo.id;
    socket.emit('message:send', payload, (response) => {
      setSending(false);
      if (response?.error) {
        Alert.alert('Error', response.error);
      }
      setReplyTo(null);
    });
    setText('');
    if (socket) {
      socket.emit('message:typing', { chatId, isTyping: false });
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    await sendMessage(text.trim());
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        const uploaded = await uploadApi.file(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
        await sendMessage('', 'image', { fileUrl: uploaded.url, fileName: uploaded.fileName, fileSize: uploaded.fileSize });
      } catch (err) {
        Alert.alert('Upload Gagal', err.message || 'Gagal upload gambar');
      }
    }
  }

  async function pickDocument() {
    try {
      const { getDocumentAsync } = await import('expo-document-picker');
      const result = await getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uploaded = await uploadApi.file(asset.uri, asset.name || 'file', asset.mimeType || 'application/octet-stream');
      await sendMessage(asset.name || 'File', 'file', { fileUrl: uploaded.url, fileName: uploaded.fileName, fileSize: uploaded.fileSize });
    } catch (err) {
      Alert.alert('Upload Gagal', err.message || 'Gagal upload file');
    }
  }

  async function startRecording() {
    Alert.alert('Fitur Dimatikan', 'Fitur rekaman suara tidak didukung di Expo Go.');
  }

  async function stopRecording() {
    return;
  }

  async function playAudio(fileUrl) {
    Alert.alert('Fitur Dimatikan', 'Fitur pemutaran suara tidak didukung di Expo Go.');
  }

  async function downloadFile(item) {
    setDownloadingFile(item.id);
    try {
      const url = `${API_URL}${item.fileUrl}`;
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Tidak dapat membuka file');
    }
    setDownloadingFile(null);
  }

  function formatAudioTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  function sendEditedMessage(messageId, newContent) {
    if (!socket || !newContent.trim()) return;
    socket.emit('message:edit', { messageId, chatId, content: newContent.trim() });
    setText('');
    setEditingMessage(null);
  }

  async function loadAllChats() {
    try {
      const data = await chatsApi.getAll();
      setAllChats(data || []);
    } catch (err) {}
  }

  function handleMessageLongPress(item) {
    if (item.type === 'system') return;
    setActionMessage(item);
  }

  function renderActionModal() {
    if (!actionMessage) return null;
    const isMe = actionMessage.senderId === user?.id;
    const isText = actionMessage.type === 'text';

    const handleAction = async (opt) => {
      setActionMessage(null);
      if (opt === 'Reaksi') setReactTarget(actionMessage);
      else if (opt === 'Balas') { setReplyTo(actionMessage); setText(''); }
      else if (opt === 'Teruskan') { setForwardMessage(actionMessage); loadAllChats(); }
      else if (opt === 'Salin') {
        if (actionMessage.content) {
          await Clipboard.setStringAsync(actionMessage.content);
        }
      }
      else if (opt === 'Edit') { setEditingMessage(actionMessage); setText(actionMessage.content); }
      else if (opt === 'Hapus untuk saya') {
        setMessages(prev => prev.filter(m => m.id !== actionMessage.id));
      }
      else if (opt === 'Hapus untuk semua') {
        if (socket) socket.emit('message:delete', { messageId: actionMessage.id, chatId, deleteForEveryone: true });
      }
    };

    return (
      <Modal visible={true} transparent animationType="fade" onRequestClose={() => setActionMessage(null)}>
        <TouchableOpacity style={styles.actionModalOverlay} activeOpacity={1} onPress={() => setActionMessage(null)}>
          <View style={[styles.actionModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.actionModalHandle} />
            <Text style={[styles.actionModalTitle, { color: colors.textSecondary }]}>Opsi Pesan</Text>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Reaksi')}>
              <Ionicons name="happy-outline" size={22} color={colors.text} /><Text style={[styles.actionBtnText, { color: colors.text }]}>Beri Reaksi</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Balas')}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.text} /><Text style={[styles.actionBtnText, { color: colors.text }]}>Balas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Teruskan')}>
              <Ionicons name="arrow-redo-outline" size={22} color={colors.text} /><Text style={[styles.actionBtnText, { color: colors.text }]}>Teruskan</Text>
            </TouchableOpacity>

            {isText && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Salin')}>
                <Ionicons name="copy-outline" size={22} color={colors.text} /><Text style={[styles.actionBtnText, { color: colors.text }]}>Salin Teks</Text>
              </TouchableOpacity>
            )}

            {isMe && isText && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Edit')}>
                <Ionicons name="pencil-outline" size={22} color={colors.text} /><Text style={[styles.actionBtnText, { color: colors.text }]}>Edit Pesan</Text>
              </TouchableOpacity>
            )}

            {isMe && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Hapus untuk semua')}>
                <Ionicons name="trash-outline" size={22} color="#ff3b30" /><Text style={[styles.actionBtnText, { color: '#ff3b30' }]}>Hapus untuk semua orang</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Hapus untuk saya')}>
              <Ionicons name="trash-bin-outline" size={22} color="#ff3b30" /><Text style={[styles.actionBtnText, { color: '#ff3b30' }]}>Hapus untuk saya</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date-separator') {
      return (
        <View style={styles.dateSepRow}>
          <View style={[styles.dateSepBg, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.dateSepText, { color: colors.textSecondary }]}>
              {formatDateSeparator(item.date)}
            </Text>
          </View>
        </View>
      );
    }

    const isMe = item.senderId === user?.id;
    const isSystem = item.type === 'system';
    const time = new Date(item.createdAt).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    });
    const isRead = item.readBy?.length > 1;

    if (isSystem) {
      return (
        <View style={styles.systemMsg}>
          <View style={[styles.systemDot, { backgroundColor: colors.textSecondary }]} />
          <Text style={[styles.systemText, { color: colors.textSecondary }]}>{item.content}</Text>
          <View style={[styles.systemDot, { backgroundColor: colors.textSecondary }]} />
        </View>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => handleMessageLongPress(item)}
        style={[styles.msgRow, isMe ? styles.myMsgRow : styles.theirMsgRow]}
      >
        {!isMe && (
          <View style={styles.avatarCol}>
            {item.senderAvatar ? (
              <Image source={{ uri: `${API_URL}${item.senderAvatar}` }} style={styles.msgAvatar} />
            ) : (
              <View style={[styles.msgAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.msgAvatarText}>
                  {(item.senderDisplayName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.bubbleWrap, isMe ? styles.myBubbleWrap : styles.theirBubbleWrap]}>
          {!isMe && chat.type === 'group' && (
            <Text style={[styles.bubbleSender, { color: colors.primary, fontSize: chatFontSize - 3 }]}>{item.senderDisplayName}</Text>
          )}
          {item.replyData && (
            <View style={[styles.replyPreview, { backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={[styles.replyLine, { backgroundColor: isMe ? '#fff' : colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyLabel, { color: isMe ? 'rgba(255,255,255,0.8)' : colors.primary }]}>Balasan</Text>
                <Text style={[styles.replyContent, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]} numberOfLines={1}>
                  {item.replyData.content || '[Gambar]'}
                </Text>
              </View>
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, { backgroundColor: isMe ? bubbleSelfColor : colors.bubbleOther }]}>
            {item.type === 'image' ? (
              <TouchableOpacity onPress={() => setPreviewImage(`${API_URL}${item.fileUrl}`)}>
                <Image source={{ uri: `${API_URL}${item.fileUrl}` }} style={styles.bubbleImage} />
              </TouchableOpacity>
            ) : item.type === 'audio' ? (
              <TouchableOpacity style={styles.audioRow} onPress={() => playAudio(item.fileUrl)}>
                <Ionicons name={playingAudio === item.fileUrl ? 'stop-circle' : 'play-circle'} size={32} color={isMe ? '#fff' : colors.primary} />
                <View style={[styles.audioBarBg, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
                  <View style={[styles.audioBarFill, { backgroundColor: isMe ? '#fff' : colors.primary, width: audioProgress.duration ? `${(audioProgress.position / audioProgress.duration) * 100}%` : 0 }]} />
                </View>
                <Text style={[styles.audioDuration, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                  {audioProgress.duration ? formatAudioTime(audioProgress.duration) : '0:30'}
                </Text>
              </TouchableOpacity>
            ) : item.type === 'file' ? (
              <TouchableOpacity style={styles.fileRow} onPress={() => downloadFile(item)} disabled={downloadingFile === item.id}>
                <Ionicons name="document-attach" size={28} color={isMe ? '#fff' : colors.textSecondary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.fileName, { color: isMe ? '#fff' : colors.text }]} numberOfLines={1}>
                    {downloadingFile === item.id ? 'Mengunduh...' : (item.fileName || 'File')}
                  </Text>
                  <Text style={[styles.fileSize, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>
                    {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.bubbleText, { color: isMe ? bubbleSelfTextColor : colors.bubbleOtherText, fontSize: chatFontSize }]}>{item.content}</Text>
            )}
          </View>
          {item.edited ? (
            <Text style={[styles.editedLabel, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>diedit</Text>
          ) : null}
          <View style={[styles.bubbleMeta, isMe ? styles.myBubbleMeta : styles.theirBubbleMeta]}>
            <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>{time}</Text>
            {isMe && (
              <Ionicons name={isRead ? 'checkmark-done' : 'checkmark'} size={14} color={isRead ? '#34B7F1' : 'rgba(255,255,255,0.5)'} style={{ marginLeft: 2 }} />
            )}
          </View>
          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={[styles.reactionsRow, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {Object.entries(item.reactions).map(([emoji, userIds]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.reactionBadge, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
                  onPress={() => socket?.emit('message:react', { messageId: item.id, chatId, emoji })}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>{userIds.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [user?.id, playingAudio, audioProgress, colors, mode, chatFontSize, chat.type, bubbleSelfColor, bubbleSelfTextColor, socket, chatId, downloadingFile]);

  const typingText = Object.keys(typingUsers).length > 0 ? 'Sedang mengetik...' : '';

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradient}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerInfo}
              activeOpacity={0.7}
              onPress={() => {
                if (chat.type === 'group') navigation.navigate('GroupInfo', { chatId, chat });
                else if (chat.type === 'direct' && otherMember) navigation.navigate('FriendProfile', { userId: otherMember.id });
              }}
            >
              {chat.type === 'direct' && otherMember?.avatar ? (
                <Image source={{ uri: `${API_URL}${otherMember.avatar}` }} style={styles.headerAvatar} />
              ) : chat.type === 'group' && chat.avatar ? (
                <Image source={{ uri: `${API_URL}${chat.avatar}` }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{chatName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.headerName} numberOfLines={1}>{chatName}</Text>
                <View style={styles.headerStatusRow}>
                  {chat.type === 'direct' && (
                    <View style={[styles.statusDot, { backgroundColor: isOtherOnline ? '#4ade80' : '#9ca3af' }]} />
                  )}
                  <Text style={styles.headerStatus}>
                    {chat.type === 'direct' && otherUserId
                      ? (isOtherOnline ? 'Online' : 'Offline')
                      : `${chat.members?.length || 0} anggota`}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Call', {
                type: 'voice', targetUser: otherMember, direction: 'outgoing',
              })}>
                <Ionicons name="call" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Call', {
                type: 'video', targetUser: otherMember, direction: 'outgoing',
              })}>
                <Ionicons name="videocam" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={displayItems}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={displayItems.length === 0 ? styles.emptyListContent : styles.listContent}
              inverted={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Belum ada pesan</Text>
                </View>
              }
              ListFooterComponent={typingText ? (
                <View style={styles.typingRow}>
                  <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.typingLabel, { color: colors.textSecondary }]}>{typingText}</Text>
                </View>
              ) : null}
            />
          )}

          {recordingState === 'recording' && (
            <View style={[styles.recordingBar, { backgroundColor: mode === 'dark' ? '#1c1c1e' : '#ffebee', borderTopColor: colors.border }]}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Merekam...</Text>
              <TouchableOpacity onPress={stopRecording} style={styles.stopRecordBtn}>
                <Ionicons name="stop" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {replyTo && (
            <View style={[styles.replyBar, { backgroundColor: mode === 'dark' ? colors.card : '#f0fdf4', borderTopColor: colors.border }]}>
              <View style={[styles.replyBarLine, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyBarLabel, { color: colors.primary }]}>Membalas {replyTo.senderId === user?.id ? 'diri sendiri' : replyTo.senderDisplayName}</Text>
                <Text style={[styles.replyBarContent, { color: colors.textSecondary }]} numberOfLines={1}>{replyTo.content || '[Gambar]'}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyBarClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {editingMessage && (
            <View style={[styles.replyBar, { backgroundColor: mode === 'dark' ? colors.card : '#fff9e6', borderTopColor: colors.border }]}>
              <View style={[styles.replyBarLine, { backgroundColor: '#f59e0b' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyBarLabel, { color: '#f59e0b' }]}>Mode Edit</Text>
                <Text style={[styles.replyBarContent, { color: colors.textSecondary }]} numberOfLines={1}>{editingMessage.content}</Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingMessage(null); setText(''); }} style={styles.replyBarClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {canSend ? (
            <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowAttach(!showAttach)} style={styles.inputAttach}>
                <Ionicons name={showAttach ? 'remove-circle' : 'add-circle'} size={26} color={colors.primary} />
              </TouchableOpacity>
              {showAttach && (
                <View style={[styles.attachMenu, { backgroundColor: colors.card }]}>
                  <TouchableOpacity style={styles.attachItem} onPress={() => { setShowAttach(false); pickImage(); }}>
                    <View style={[styles.attachIconWrap, { backgroundColor: '#FF6B6B' }]}>
                      <Ionicons name="image" size={22} color="#fff" />
                    </View>
                    <Text style={[styles.attachLabel, { color: colors.textSecondary }]}>Gambar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachItem} onPress={() => { setShowAttach(false); pickDocument(); }}>
                    <View style={[styles.attachIconWrap, { backgroundColor: '#4A90D9' }]}>
                      <Ionicons name="document" size={22} color="#fff" />
                    </View>
                    <Text style={[styles.attachLabel, { color: colors.textSecondary }]}>File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachItem} onPress={() => { setShowAttach(false); startRecording(); }}>
                    <View style={[styles.attachIconWrap, { backgroundColor: '#FF6B6B' }]}>
                      <Ionicons name="mic" size={22} color="#fff" />
                    </View>
                    <Text style={[styles.attachLabel, { color: colors.textSecondary }]}>Rekam</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={[styles.inputWrap, { backgroundColor: colors.inputBg }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Ketik pesan..."
                  placeholderTextColor={colors.textSecondary}
                  value={text}
                  onChangeText={handleTyping}
                  multiline
                  maxLength={1000}
                  blurOnSubmit={!!settings.enterToSend}
                  onSubmitEditing={settings.enterToSend ? handleSend : undefined}
                />
              </View>
              {text.trim() ? (
                <TouchableOpacity
                  style={[styles.inputSend, { backgroundColor: editingMessage ? '#f59e0b' : colors.primary }]}
                  onPress={editingMessage ? () => sendEditedMessage(editingMessage.id, text) : handleSend}
                  disabled={!text.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.inputMic}
                  onPress={startRecording}
                  disabled={recordingState === 'recording'}
                >
                  <Ionicons name="mic" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.restrictedBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.restrictedText, { color: colors.textSecondary }]}>Hanya admin yang dapat mengirim pesan</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      {renderActionModal()}
      <Modal visible={!!previewImage} transparent onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!reactTarget} transparent animationType="fade" onRequestClose={() => setReactTarget(null)}>
        <TouchableOpacity style={styles.reactOverlay} activeOpacity={1} onPress={() => setReactTarget(null)}>
          <View style={[styles.reactPicker, { backgroundColor: colors.card }]}>
            {['❤️', '😂', '👍', '😮', '😢', '😡', '🔥', '👏'].map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactEmoji}
                onPress={() => {
                  if (socket && reactTarget) {
                    socket.emit('message:react', { messageId: reactTarget.id, chatId, emoji });
                  }
                  setReactTarget(null);
                }}
              >
                <Text style={styles.reactEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!forwardMessage} transparent animationType="slide" onRequestClose={() => setForwardMessage(null)}>
        <View style={styles.forwardOverlay}>
          <View style={[styles.forwardSheet, { backgroundColor: colors.card }]}>
            <View style={styles.forwardHeader}>
              <Text style={[styles.forwardTitle, { color: colors.text }]}>Teruskan ke...</Text>
              <TouchableOpacity onPress={() => setForwardMessage(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={allChats.filter(c => c.id !== chatId)}
              keyExtractor={c => c.id}
              renderItem={({ item: c }) => {
                const otherM = c.members?.find(m => m.id !== user?.id);
                const name = c.type === 'group' ? (c.name || 'Grup') : (otherM?.displayName || 'Chat');
                return (
                  <TouchableOpacity
                    style={[styles.forwardItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      if (socket && forwardMessage) {
                        socket.emit('message:send', {
                          chatId: c.id,
                          content: forwardMessage.content || '',
                          type: forwardMessage.type,
                          fileUrl: forwardMessage.fileUrl,
                          fileName: forwardMessage.fileName,
                          fileSize: forwardMessage.fileSize,
                        });
                        Alert.alert('', `Diteruskan ke ${name}`);
                      }
                      setForwardMessage(null);
                    }}
                  >
                    <View style={[styles.forwardAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.forwardName, { color: colors.text }]}>{name}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={[{ color: colors.textSecondary, textAlign: 'center', padding: 20 }]}>Tidak ada chat lain</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingTop: 54,
    paddingBottom: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: { padding: 8, marginRight: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  headerStatus: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { padding: 10, marginLeft: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 70 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 12 },
  emptyContainer: { alignItems: 'center' },
  emptyIcon: { marginBottom: 16, backgroundColor: 'rgba(108,99,255,0.1)', padding: 20, borderRadius: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#8E8E9A' },
  dateSepRow: { alignItems: 'center', marginVertical: 16 },
  dateSepBg: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.05)' },
  dateSepText: { fontSize: 12, fontWeight: '700', color: '#8E8E9A' },
  msgRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  myMsgRow: { justifyContent: 'flex-end' },
  theirMsgRow: { justifyContent: 'flex-start' },
  avatarCol: { marginRight: 8, marginBottom: 4 },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  msgAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  bubbleWrap: { maxWidth: '75%' },
  myBubbleWrap: { alignItems: 'flex-end' },
  theirBubbleWrap: { alignItems: 'flex-start' },
  bubbleSender: { fontWeight: '700', fontSize: 13, marginBottom: 4, marginLeft: 2 },
  replyPreview: {
    flexDirection: 'row', marginBottom: 6,
    borderRadius: 10, padding: 8, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyLine: { width: 4, borderRadius: 2, marginRight: 10, alignSelf: 'stretch' },
  replyLabel: { fontSize: 12, fontWeight: '700' },
  replyContent: { fontSize: 13, marginTop: 2 },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  myBubble: {
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    borderBottomLeftRadius: 6,
  },
  bubbleText: { lineHeight: 22, fontSize: 15 },
  bubbleImage: { width: 200, height: 200, borderRadius: 10, margin: -2 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, paddingHorizontal: 2 },
  myBubbleMeta: { justifyContent: 'flex-end' },
  theirBubbleMeta: { justifyContent: 'flex-start' },
  bubbleTime: { fontSize: 10 },
  audioRow: { flexDirection: 'row', alignItems: 'center', minWidth: 160, paddingVertical: 4 },
  audioBarBg: {
    flex: 1, height: 4,
    borderRadius: 2, marginHorizontal: 8, overflow: 'hidden',
  },
  audioBarFill: { height: 4, borderRadius: 2 },
  audioDuration: { fontSize: 11, minWidth: 30, textAlign: 'right' },
  fileRow: { flexDirection: 'row', alignItems: 'center', minWidth: 140, paddingVertical: 4 },
  fileName: { fontSize: 13, fontWeight: '500' },
  fileSize: { fontSize: 10, marginTop: 1 },
  systemMsg: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 10, paddingHorizontal: 20,
  },
  systemDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 8 },
  systemText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, marginBottom: 4, paddingHorizontal: 12 },
  typingDot: { width: 5, height: 5, borderRadius: 3, marginRight: 3, opacity: 0.7 },
  typingLabel: { fontSize: 12, fontStyle: 'italic', marginLeft: 6 },
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5,
  },
  replyBarLine: { width: 3, borderRadius: 2, marginRight: 10, alignSelf: 'stretch' },
  replyBarLabel: { fontSize: 12, fontWeight: '600' },
  replyBarContent: { fontSize: 13, marginTop: 1 },
  replyBarClose: { padding: 6 },
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderTopWidth: 0.5,
  },
  recordingDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#d32f2f', marginRight: 10,
  },
  recordingText: { fontSize: 15, color: '#d32f2f', fontWeight: '600', marginRight: 16 },
  stopRecordBtn: {
    backgroundColor: '#d32f2f', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  inputAttach: { padding: 8 },
  attachMenu: {
    position: 'absolute', bottom: 70, left: 16,
    borderRadius: 20, padding: 16, elevation: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12,
    flexDirection: 'row', gap: 16, zIndex: 100,
  },
  attachItem: { alignItems: 'center', minWidth: 64 },
  attachIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  attachLabel: { fontSize: 12, fontWeight: '600' },
  inputWrap: {
    flex: 1, borderRadius: 24, marginHorizontal: 8,
    borderWidth: 1.5, borderColor: '#EBEBF0',
  },
  input: {
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100,
  },
  inputSend: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  inputMic: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  restrictedBar: {
    flexDirection: 'row', padding: 16,
    borderTopWidth: 0.5, justifyContent: 'center', alignItems: 'center',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  restrictedText: { fontSize: 13 },
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  editedLabel: { fontSize: 10, fontStyle: 'italic', paddingHorizontal: 2, marginTop: 1 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 12, gap: 2,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: '600' },
  reactOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  reactPicker: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    padding: 12, borderRadius: 20, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
    maxWidth: 320,
  },
  reactEmoji: { padding: 8, borderRadius: 12 },
  reactEmojiText: { fontSize: 28 },
  forwardOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  forwardSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 10,
  },
  forwardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  forwardTitle: { fontSize: 17, fontWeight: '700' },
  forwardItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  forwardAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  forwardName: { fontSize: 15, fontWeight: '600' },
});
