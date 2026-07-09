import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import { Ionicons } from '@expo/vector-icons';

const SECTIONS = [
  {
    title: 'Akun',
    items: [
      { label: 'Profil Saya', screen: 'Profile', icon: 'person-outline', color: '#6C63FF', bg: '#6C63FF18' },
      { label: 'Akun & Keamanan', screen: 'Account', icon: 'shield-checkmark-outline', color: '#4ECDC4', bg: '#4ECDC418' },
      { label: 'Privasi', screen: 'Privacy', icon: 'lock-closed-outline', color: '#FF6B9D', bg: '#FF6B9D18' },
    ],
  },
  {
    title: 'Preferensi',
    items: [
      { label: 'Chat & Tampilan', screen: 'ChatSettings', icon: 'chatbubbles-outline', color: '#44A1E0', bg: '#44A1E018' },
      { label: 'Notifikasi', screen: 'NotificationSettings', icon: 'notifications-outline', color: '#FF9F43', bg: '#FF9F4318' },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Backup & Restore', screen: 'BackupChat', icon: 'cloud-upload-outline', color: '#2ED573', bg: '#2ED57318' },
    ],
  },
];

export default function SettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, mode } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Gradient header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Saya</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Profile Hero Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.75}
        >
          <LinearGradient
            colors={[colors.gradientStart + '20', colors.gradientEnd + '10']}
            style={styles.profileCardGradient}
          />
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: `${API_URL}${user.avatar}` }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={styles.avatar}
              >
                <Text style={styles.avatarLetter}>
                  {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <View style={[styles.onlineBadge, { borderColor: colors.card, backgroundColor: colors.online }]} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
              {user?.displayName || user?.username}
            </Text>
            <Text style={[styles.username, { color: colors.textSecondary }]}>@{user?.username}</Text>
            <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={1}>
              {user?.bio || 'Ketuk untuk edit profil ✏️'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Settings sections */}
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.screen}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.borderLight }
                  ]}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.65}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Version info */}
        <Text style={[styles.version, { color: colors.textTertiary }]}>Zentro v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 58, paddingBottom: 18, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginTop: 20, borderRadius: 20, padding: 16,
    overflow: 'hidden',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  profileCardGradient: {
    ...StyleSheet.absoluteFillObject, borderRadius: 20,
  },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 26, fontWeight: '900' },
  onlineBadge: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
  },
  profileInfo: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  username: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 4 },
  section: { marginTop: 24, marginHorizontal: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    borderRadius: Platform.OS === 'ios' ? 12 : 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0 : 0.06, shadowRadius: 8, elevation: 3,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 32, marginBottom: 8 },
});
