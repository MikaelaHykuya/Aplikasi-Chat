import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { users as usersApi, chats as chatsApi } from '../services/api';

export default function GroupCreateScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFriends();
  }, []);

  async function loadFriends() {
    try {
      const data = await usersApi.getFriends();
      setFriends(data);
    } catch (err) {
      console.log(err);
    }
  }

  function toggleSelect(friendId) {
    setSelected(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  }

  async function createGroup() {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Nama grup wajib diisi');
      return;
    }
    if (selected.length < 1) {
      Alert.alert('Error', 'Pilih minimal 1 anggota');
      return;
    }

    setCreating(true);
    try {
      const result = await chatsApi.createGroup(groupName.trim(), selected);
      navigation.replace('Chat', {
        chatId: result.id,
        chat: { ...result, members: [{ id: user.id, displayName: user.displayName }] }
      });
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  }

  const filteredFriends = friends.filter(f =>
    f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: colors.headerText }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Grup Baru</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <TextInput
          style={[styles.groupNameInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          placeholder="Nama Grup"
          value={groupName}
          onChangeText={setGroupName}
        />
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg }]}
          placeholder="Cari teman..."
          value={search}
          onChangeText={setSearch}
        />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Anggota ({selected.length} dipilih)
        </Text>

        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.friendItem, isSelected && styles.selectedItem]}
                onPress={() => toggleSelect(item.id)}
              >
                <View style={[styles.checkbox, isSelected && styles.checked]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.displayName?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.friendName, { color: colors.text }]}>{item.displayName}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          style={[styles.createBtn, (!groupName.trim() || selected.length === 0) && styles.createBtnDisabled]}
          onPress={createGroup}
          disabled={creating || !groupName.trim() || selected.length === 0}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Buat Grup</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16
  },
  backBtn: { fontSize: 28, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  groupNameInput: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    fontSize: 16, marginBottom: 12
  },
  searchInput: {
    borderRadius: 12, padding: 12,
    fontSize: 14, marginBottom: 16
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  friendItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 12, marginBottom: 4
  },
  selectedItem: { backgroundColor: '#e8f5e9' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  checked: { borderColor: '#07C160', backgroundColor: '#07C160' },
  checkMark: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#4A90D9',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  friendName: { fontSize: 16 },
  createBtn: {
    backgroundColor: '#07C160', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 12
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
