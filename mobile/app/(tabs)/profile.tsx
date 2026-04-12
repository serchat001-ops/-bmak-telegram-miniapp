import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { fmtNum } from '@/lib/api';
import { colors } from '@/constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, config, logout } = useAuth();

  const name = user?.display_name || user?.first_name || user?.username || 'User';
  const bal = parseFloat(user?.bmak_balance || '0');
  const earned = parseFloat(user?.total_earned || '0');

  function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await logout(); } },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, user?.auth_type === 'telegram' ? styles.badgeTg : styles.badgeWeb]}>
            <Ionicons name={user?.auth_type === 'telegram' ? 'paper-plane' : 'globe'} size={12} color="#fff" />
            <Text style={styles.badgeText}>{user?.auth_type === 'telegram' ? 'Telegram' : 'Web'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsCard}>
        <StatRow label="Solde BMAK" value={`${fmtNum(bal)} BMAK`} icon="diamond" />
        <StatRow label="Total gagné" value={`${fmtNum(earned)} BMAK`} icon="trending-up" />
        <StatRow label="Streak actuel" value={`${user?.checkin_streak || 0} jours 🔥`} icon="flame" />
        <StatRow label="Filleuls" value={String(user?.total_referrals || 0)} icon="people" last />
      </View>

      {user?.wallet_address ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet BSC</Text>
          <View style={styles.walletCard}>
            <Ionicons name="wallet" size={18} color={colors.primary} />
            <Text style={styles.walletAddr} numberOfLines={1}>{user.wallet_address}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.menuCard}>
          {config?.adminEmail && user?.email === config.adminEmail ? (
            <MenuItem icon="shield" label="Panneau Admin" color={colors.primary} onPress={() => Alert.alert('Admin', 'Accédez au panneau admin depuis le navigateur web')} />
          ) : null}
          <MenuItem icon="log-out" label="Déconnexion" color={colors.danger} onPress={handleLogout} last />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>B_MAK Blockchain Rewards Platform</Text>
        <Text style={styles.footerText}>BSC Mainnet · Chain ID 56</Text>
        {config?.contractAddress ? (
          <Text style={styles.footerContract}>Contrat: {config.contractAddress.slice(0, 10)}...</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function StatRow({ label, value, icon, last }: { label: string; value: string; icon: any; last?: boolean }) {
  return (
    <View style={[srStyles.row, !last && srStyles.border]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={srStyles.label}>{label}</Text>
      <Text style={srStyles.value}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, color, onPress, last }: { icon: any; label: string; color: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[miStyles.row, !last && miStyles.border]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[miStyles.label, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  profileCard: {
    alignItems: 'center', margin: 16,
    backgroundColor: colors.bgCard, borderRadius: colors.radiusXl,
    borderWidth: 1, borderColor: colors.border, padding: 28,
  },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarLetter: { color: colors.primary, fontSize: 30, fontFamily: 'Inter_700Bold' },
  profileName: { color: colors.text, fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  profileEmail: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTg: { backgroundColor: '#2481cc' },
  badgeWeb: { backgroundColor: colors.primary },
  badgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  statsCard: { marginHorizontal: 16, marginBottom: 20, backgroundColor: colors.bgCard, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  walletCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16 },
  walletAddr: { flex: 1, color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular' },
  menuCard: { backgroundColor: colors.bgCard, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  footer: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  footerText: { color: colors.text3, fontSize: 12, fontFamily: 'Inter_400Regular' },
  footerContract: { color: colors.text3, fontSize: 11, fontFamily: 'Inter_400Regular' },
});

const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { flex: 1, color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular' },
  value: { color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

const miStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
});
