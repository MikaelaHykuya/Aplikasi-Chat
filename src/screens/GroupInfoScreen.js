import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, TextInput, Image, ActivityIndicator, ScrollView, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { chats as chatsApi, users as usersApi, addGroupMembers, removeGroupMember, updateGroupName, deleteGroup, updateGroupSettings, updateMemberRole, updateGroupAvatar } from '../services/api';
import { upload as uploadApi } from '../services/api';
import { API_URL } from '../config/api';

export default function GroupInfoScreen({ route, navigation }) {
  const { chatId, chat: chatData } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [chat, setChat] = useState(chatData || {});
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(chat.name || '');
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(chat.description || '');
  const [saving, setSaving] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const isAdmin = chat.members?.find(m => m.id === user?.id)?.role === 'admin';
  const styles = getStyles(colors);

  useEffect(() => {
    loadChat();
  }, []);

  async function loadChat() {
    try {
      const data = await chatsApi.getById(chatId);
      setChat(data);
      setName(data.name || '');
      setBio(data.description || '');

      const mut = await AsyncStorage.getItem('mutedChats');
      const arch = await AsyncStorage.getItem('archivedChats');
      if (mut && JSON.parse(mut)[chatId]) setIsMuted(true);
      if (arch && JSON.parse(arch)[chatId]) setIsArchived(true);
    } catch (err) {}
  }

  async function togglePreference(key, stateVal, setStateFn) {
    try {
      const stored = await AsyncStorage.getItem(key);
      const data = stored ? JSON.parse(stored) : {};
      if (data[chatId]) delete data[chatId];
      else data[chatId] = true;
      setStateFn(!stateVal);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  async function handleSaveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateGroupName(chatId, name.trim());
      setEditingName(false);
      loadChat();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBio() {
    setSaving(true);
    try {
      await updateGroupSettings(chatId, { description: bio.trim() });
      setEditingBio(false);
      loadChat();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const file = result.assets[0];
      const uploadResult = await uploadApi.file(file.uri, 'group_avatar.jpg', file.mimeType || 'image/jpeg');
      await updateGroupAvatar(chatId, uploadResult.url);
      loadChat();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    }
  }

  async function openAddMembers() {
    try {
      const data = await usersApi.getFriends();
      const memberIds = chat.members?.map(m => m.id) || [];
      setFriends(data.filter(f => !memberIds.includes(f.id)));
      setShowAddMembers(true);
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat daftar teman');
    }
  }

  async function handleAddMembers() {
    if (!selectedIds.length) return;
    try {
      await addGroupMembers(chatId, selectedIds);
      setShowAddMembers(false);
      setSelectedIds([]);
      loadChat();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleRemoveMember(memberId) {
    Alert.alert('Hapus anggota', 'Yakin ingin menghapus anggota ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await removeGroupMember(chatId, memberId);
          loadChat();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }},
    ]);
  }

  async function handleToggleRole(memberId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const label = newRole === 'admin' ? 'Jadikan Admin' : 'Hapus Admin';
    Alert.alert(label, 'Yakin?', [
      { text: 'Batal', style: 'cancel' },
      { text: label, onPress: async () => {
        try {
          await updateMemberRole(chatId, memberId, newRole);
          loadChat();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }},
    ]);
  }

  async function handleToggleSetting(key, value) {
    try {
      await updateGroupSettings(chatId, { [key]: value });
      loadChat();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  function handleDisband() {
    Alert.alert('Bubarkan Grup', 'Semua pesan akan dihapus. Yakin?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Bubarkan', style: 'destructive', onPress: async () => {
        try {
          await deleteGroup(chatId);
          navigation.popToTop();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }},
    ]);
  }

  function toggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Info Grup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity onPress={isAdmin ? handlePickAvatar : undefined} style={styles.avatarWrap}>
          {chat.avatar ? (
            <Image source={{ uri: `${API_URL}${chat.avatar}` }} style={styles.groupAvatar} />
          ) : (
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>{(chat.name || 'G').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {isAdmin && <Text style={styles.changeAvatarText}>Tap ganti foto</Text>}
        </TouchableOpacity>

        {editingName ? (
          <View style={styles.editRow}>
            <TextInput style={styles.editInput} value={name} onChangeText={setName} autoFocus />
            <TouchableOpacity onPress={handleSaveName} disabled={saving}>
              {saving ? <ActivityIndicator /> : <Text style={styles.saveBtn}>Simpan</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => isAdmin && setEditingName(true)}>
            <Text style={styles.groupName}>{chat.name || 'Grup'}</Text>
          </TouchableOpacity>
        )}

        {editingBio ? (
          <View style={styles.editRow}>
            <TextInput style={styles.editInput} value={bio} onChangeText={setBio} autoFocus />
            <TouchableOpacity onPress={handleSaveBio} disabled={saving}>
              {saving ? <ActivityIndicator /> : <Text style={styles.saveBtn}>Simpan</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => isAdmin && setEditingBio(true)}>
            <Text style={styles.groupBio}>{chat.description || (isAdmin ? 'Ketuk tambah deskripsi' : '')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Pengaturan Pribadi</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Bisukan Notifikasi</Text>
          <Switch
            value={isMuted}
            onValueChange={() => togglePreference('mutedChats', isMuted, setIsMuted)}
            trackColor={{ false: '#ddd', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Arsipkan Grup</Text>
          <Switch
            value={isArchived}
            onValueChange={() => togglePreference('archivedChats', isArchived, setIsArchived)}
            trackColor={{ false: '#ddd', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Pengaturan Grup</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Kirim Pesan</Text>
              <View style={styles.settingOptions}>
                <TouchableOpacity
                  style={[styles.settingOption, (!chat.sendPermission || chat.sendPermission === 'all') && styles.settingOptionActive]}
                  onPress={() => handleToggleSetting('sendPermission', 'all')}
                >
                  <Text style={[styles.settingOptionText, (!chat.sendPermission || chat.sendPermission === 'all') && styles.settingOptionTextActive]}>Semua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingOption, chat.sendPermission === 'admin' && styles.settingOptionActive]}
                  onPress={() => handleToggleSetting('sendPermission', 'admin')}
                >
                  <Text style={[styles.settingOptionText, chat.sendPermission === 'admin' && styles.settingOptionTextActive]}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Tambah Anggota</Text>
              <View style={styles.settingOptions}>
                <TouchableOpacity
                  style={[styles.settingOption, (!chat.addMemberPermission || chat.addMemberPermission === 'all') && styles.settingOptionActive]}
                  onPress={() => handleToggleSetting('addMemberPermission', 'all')}
                >
                  <Text style={[styles.settingOptionText, (!chat.addMemberPermission || chat.addMemberPermission === 'all') && styles.settingOptionTextActive]}>Semua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingOption, chat.addMemberPermission === 'admin' && styles.settingOptionActive]}
                  onPress={() => handleToggleSetting('addMemberPermission', 'admin')}
                >
                  <Text style={[styles.settingOptionText, chat.addMemberPermission === 'admin' && styles.settingOptionTextActive]}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Setujui Anggota Baru</Text>
              <Switch
                value={!!chat.approvalRequired}
                onValueChange={(v) => handleToggleSetting('approvalRequired', v)}
                trackColor={{ false: '#ddd', true: '#07C160' }}
                thumbColor="#fff"
              />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Anggota ({chat.members?.length || 0})</Text>
        {chat.members?.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.memberItem}
            onPress={() => isAdmin && item.id !== user?.id && handleToggleRole(item.id, item.role)}
            disabled={!isAdmin || item.id === user?.id}
          >
            {item.avatar ? (
              <Image source={{ uri: `${API_URL}${item.avatar}` }} style={styles.memberAvatar} />
            ) : (
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{(item.displayName || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.displayName}</Text>
              <Text style={styles.memberRole}>{item.role === 'admin' ? 'Admin' : 'Anggota'}</Text>
            </View>
            {isAdmin && item.id !== user?.id && (
              <TouchableOpacity onPress={() => handleRemoveMember(item.id)}>
                <Text style={styles.removeBtn}>Keluarkan</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        {isAdmin && (
          <View style={{ marginTop: 16 }}>
            <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMembers}>
              <Text style={styles.addMemberBtnText}>+ Tambah Anggota</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.disbandBtn} onPress={handleDisband}>
              <Text style={styles.disbandBtnText}>Bubarkan Grup</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {showAddMembers && (
        <View style={styles.addModal}>
          <Text style={styles.modalTitle}>Tambah Anggota</Text>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.selectItem} onPress={() => toggleSelect(item.id)}>
                <View style={[styles.checkbox, selectedIds.includes(item.id) && styles.checked]} />
                <Text style={styles.selectName}>{item.displayName}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => setShowAddMembers(false)}>
              <Text style={styles.cancelBtn}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddMembers} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Tambah</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16
    },
    backBtn: { fontSize: 28, color: colors.headerText, fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.headerText },
    content: { padding: 20, flex: 1 },
    avatarWrap: { alignItems: 'center', marginBottom: 12 },
    groupAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center' },
    groupAvatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
    changeAvatarText: { fontSize: 12, color: '#07C160', marginTop: 4 },
    groupName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: colors.text },
    groupBio: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 8 },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
    editInput: { flex: 1, borderWidth: 1, borderColor: '#07C160', borderRadius: 8, padding: 10, fontSize: 16, color: colors.text },
    saveBtn: { color: '#07C160', fontWeight: '600', fontSize: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: colors.text },
    settingRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border,
    },
    settingLabel: { fontSize: 15, color: colors.text, flex: 1 },
    settingOptions: { flexDirection: 'row', gap: 8 },
    settingOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
    settingOptionActive: { borderColor: '#07C160', backgroundColor: '#e8f5e9' },
    settingOptionText: { fontSize: 13, color: colors.textSecondary },
    settingOptionTextActive: { color: '#07C160', fontWeight: '600' },
    memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#07C160', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    memberAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    memberName: { fontSize: 16, fontWeight: '500', color: colors.text },
    memberRole: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    removeBtn: { color: '#ff4444', fontSize: 13, fontWeight: '500' },
    addMemberBtn: { padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#07C160', borderRadius: 12, borderStyle: 'dashed' },
    addMemberBtnText: { color: '#07C160', fontWeight: '600' },
    disbandBtn: { marginTop: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ff4444', borderRadius: 12 },
    disbandBtnText: { color: '#ff4444', fontWeight: '600' },
    addModal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, padding: 20, zIndex: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: colors.text },
    selectItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: 12 },
    checked: { backgroundColor: '#07C160', borderColor: '#07C160' },
    selectName: { fontSize: 16, color: colors.text },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 16 },
    cancelBtn: { fontSize: 16, color: colors.textSecondary, padding: 8 },
    doneBtn: { backgroundColor: '#07C160', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
    doneBtnText: { color: '#fff', fontWeight: '600' },
  });
}
