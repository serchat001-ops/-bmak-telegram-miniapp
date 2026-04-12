import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, fmtNum, formatTime } from '@/lib/api';
import { colors } from '@/constants/colors';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [checkingIn, setCheckingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: txData, refetch: refetchTx } = useQuery({
    queryKey: ['/api/transactions', user?.id],
    queryFn: () => apiFetch(`/api/transactions/${user?.id}?limit=5`),
    enabled: !!user?.id,
  });

  const today = new Date().toISOString().split('T')[0];
  const lastCheckin = user?.last_checkin ? new Date(user.last_checkin).toISOString().split('T')[0] : null;
  const checkedIn = lastCheckin === today;
  const bal = parseFloat(user?.bmak_balance || '0');
  const earned = parseFloat(user?.total_earned || '0');
  const name = user?.display_name || user?.first_name || user?.username || 'User';

  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const diff = next.getTime() - Date.now();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  async function doCheckin() {
    if (!user || checkingIn || checkedIn) return;
    setCheckingIn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const data = await apiFetch('/api/rewards/checkin', 'POST', { userId: user.id });
      if (data.success) {
        updateUser(data.user);
        queryClient.invalidateQueries({ queryKey: ['/api/transactions', user.id] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCheckingIn(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      const data = await apiFetch('/api/users/web-session', 'POST', { webUid: user?.id });
      if (data.user) updateUser(data.user);
    } catch (e) {}
    await refetchTx();
    setRefreshing(false);
  }

  const streak = user?.checkin_streak || 0;
  const ms7 = Math.min((streak / 7) * 100, 100);
  const ms14 = Math.min((streak / 14) * 100, 100);
  const ms30 = Math.min((streak / 30) * 100, 100);

  const txs: any[] = txData?.transactions || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.greeting}>Hey, {name}! 👋</Text>
            <Text style={styles.heroLabel}>Solde BMAK</Text>
            <Text style={styles.heroBalance}>{fmtNum(bal)}</Text>
            <Text style={styles.heroEarned}>Total gagné: {fmtNum(earned)} BMAK</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Streak" value={`${user?.checkin_streak || 0}🔥`} />
          <Stat label="Filleuls" value={String(user?.total_referrals || 0)} />
          <Stat label="Check-in" value={checkedIn ? '✅' : '⏳'} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.checkinCard, checkedIn && styles.checkinDone]}
        onPress={doCheckin}
        disabled={checkedIn || checkingIn}
        activeOpacity={0.8}
      >
        {checkingIn ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <>
            <Ionicons name={checkedIn ? 'checkmark-circle' : 'calendar'} size={28} color={checkedIn ? colors.success : colors.primary} />
            <View style={styles.checkinInfo}>
              <Text style={styles.checkinTitle}>{checkedIn ? 'Check-in effectué !' : 'Check-in quotidien'}</Text>
              <Text style={styles.checkinSub}>
                {checkedIn ? `Prochain dans ${hrs}h ${mins}m` : 'Gagnez 100 BMAK aujourd\'hui'}
              </Text>
            </View>
            {!checkedIn && (
              <View style={styles.checkinBadge}>
                <Text style={styles.checkinBadgeText}>+100</Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Milestones</Text>
        <MilestoneBar label="7 jours" current={streak} target={7} pct={ms7} />
        <MilestoneBar label="14 jours" current={streak} target={14} pct={ms14} />
        <MilestoneBar label="30 jours" current={streak} target={30} pct={ms30} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activité récente</Text>
        {txs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={colors.text3} />
            <Text style={styles.emptyText}>Aucune activité.{'\n'}Faites votre premier check-in !</Text>
          </View>
        ) : (
          txs.map((tx, i) => <TxRow key={i} tx={tx} />)
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function MilestoneBar({ label, current, target, pct }: { label: string; current: number; target: number; pct: number }) {
  const done = current >= target;
  return (
    <View style={msStyles.row}>
      <View style={msStyles.left}>
        <Ionicons name={done ? 'trophy' : 'flag-outline'} size={16} color={done ? colors.warning : colors.text3} />
        <Text style={[msStyles.label, done && msStyles.labelDone]}>{label}</Text>
      </View>
      <View style={msStyles.barWrap}>
        <View style={[msStyles.barFill, { width: `${pct}%` as any }, done && msStyles.barDone]} />
      </View>
      <Text style={msStyles.count}>{Math.min(current, target)}/{target}</Text>
    </View>
  );
}

const TX_ICONS: Record<string, string> = { checkin: 'calendar', referral: 'people', send: 'arrow-up', receive: 'arrow-down' };
const TX_LABELS: Record<string, string> = { checkin: 'Récompense quotidienne', referral: 'Bonus parrainage', send: 'Envoi', receive: 'Réception', admin_credit: 'Crédit admin', payout: 'Paiement', admin_debit: 'Débit admin' };

function TxRow({ tx }: { tx: any }) {
  const isSend = tx.type === 'send' || tx.type === 'admin_debit' || tx.type === 'payout';
  const amt = parseFloat(tx.amount);
  return (
    <View style={txStyles.row}>
      <View style={[txStyles.icon, { backgroundColor: isSend ? colors.dangerLight : colors.successLight }]}>
        <Ionicons name={(TX_ICONS[tx.type] || 'diamond') as any} size={18} color={isSend ? colors.danger : colors.success} />
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.type}>{TX_LABELS[tx.type] || tx.type}</Text>
        <Text style={txStyles.time}>{formatTime(tx.created_at)}</Text>
      </View>
      <Text style={[txStyles.amt, isSend ? txStyles.neg : txStyles.pos]}>
        {isSend ? '-' : '+'}{amt.toLocaleString()} BMAK
      </Text>
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    margin: 16,
    backgroundColor: colors.bgCard,
    borderRadius: colors.radiusXl,
    borderWidth: 1, borderColor: colors.border,
    padding: 20,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  heroLabel: { color: colors.text2, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  heroBalance: { color: colors.text, fontSize: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroEarned: { color: colors.text2, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: colors.primary, fontSize: 22, fontFamily: 'Inter_700Bold' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 0 },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLbl: { color: colors.text2, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkinCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, marginTop: 0,
    backgroundColor: colors.primaryLight,
    borderRadius: colors.radius,
    borderWidth: 1, borderColor: colors.primary,
    padding: 18,
  },
  checkinDone: { backgroundColor: colors.successLight, borderColor: colors.success },
  checkinInfo: { flex: 1 },
  checkinTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' },
  checkinSub: { color: colors.text2, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkinBadge: {
    backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  checkinBadgeText: { color: colors.text, fontSize: 13, fontFamily: 'Inter_700Bold' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});

const msStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 80 },
  label: { color: colors.text2, fontSize: 12, fontFamily: 'Inter_500Medium' },
  labelDone: { color: colors.warning },
  barWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  barDone: { backgroundColor: colors.warning },
  count: { color: colors.text2, fontSize: 11, fontFamily: 'Inter_400Regular', width: 36, textAlign: 'right' },
});

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  type: { color: colors.text, fontSize: 14, fontFamily: 'Inter_500Medium' },
  time: { color: colors.text3, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  amt: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pos: { color: colors.success },
  neg: { color: colors.danger },
});
