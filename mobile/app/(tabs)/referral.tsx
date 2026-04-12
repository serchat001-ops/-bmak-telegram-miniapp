import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { formatTime, fmtNum } from '@/lib/api';
import { colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: refData } = useQuery({
    queryKey: ['/api/rewards/referrals', user?.id],
    queryFn: () => apiFetch(`/api/rewards/referrals/${user?.id}`),
    enabled: !!user?.id,
  });

  const code = user?.referral_code || '';
  const totalRefs = user?.total_referrals || 0;
  const earnedFromRefs = totalRefs * 50;
  const webLink = refData?.webReferralLink || '';
  const tgLink = refData?.referralLink || '';
  const referrals: any[] = refData?.referrals || [];

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function shareLink() {
    try {
      const link = webLink || tgLink;
      await Share.share({
        message: `🌟 Rejoins B_MAK et gagne des tokens BMAK chaque jour !\n\n${link}`,
        title: 'B_MAK Blockchain Rewards',
      });
    } catch (e) {}
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Ionicons name="people" size={36} color={colors.primary} />
        <Text style={styles.heroTitle}>Programme de Parrainage</Text>
        <Text style={styles.heroSub}>Invitez des amis et gagnez 50 BMAK par filleul</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{totalRefs}</Text>
          <Text style={styles.statLbl}>Filleuls</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{fmtNum(earnedFromRefs)}</Text>
          <Text style={styles.statLbl}>BMAK gagnés</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>50</Text>
          <Text style={styles.statLbl}>BMAK / filleul</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Votre code</Text>
        <View style={styles.codeCard}>
          <Text style={styles.code}>{code || '—'}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
            <Ionicons name="copy-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {(webLink || tgLink) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liens de parrainage</Text>
          {webLink ? (
            <View style={styles.linkCard}>
              <Ionicons name="globe-outline" size={18} color={colors.accent} />
              <Text style={styles.linkText} numberOfLines={1}>{webLink}</Text>
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(webLink); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="copy-outline" size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>
          ) : null}
          {tgLink ? (
            <View style={styles.linkCard}>
              <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{tgLink}</Text>
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(tgLink); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="copy-outline" size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.shareBtn} onPress={shareLink} activeOpacity={0.8}>
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Partager mon lien</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes filleuls ({totalRefs})</Text>
        {referrals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={colors.text3} />
            <Text style={styles.emptyText}>Invitez des amis pour les voir ici !</Text>
          </View>
        ) : (
          referrals.map((r, i) => (
            <View key={i} style={styles.refRow}>
              <View style={styles.refAvatar}>
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
              <View style={styles.refInfo}>
                <Text style={styles.refName}>
                  {r.username ? `@${r.username}` : (r.display_name || r.first_name || 'Ami')}
                </Text>
                <Text style={styles.refDate}>{formatTime(r.created_at)}</Text>
              </View>
              <View style={styles.refBonus}>
                <Text style={styles.refBonusText}>+50 BMAK</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    alignItems: 'center', padding: 28,
    backgroundColor: colors.bgCard, margin: 16,
    borderRadius: colors.radiusXl, borderWidth: 1, borderColor: colors.border,
    gap: 8,
  },
  heroTitle: { color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' },
  heroSub: { color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: colors.radius,
    borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center',
  },
  statVal: { color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLbl: { color: colors.text2, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3, textAlign: 'center' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, borderRadius: colors.radius,
    borderWidth: 1, borderColor: colors.border, padding: 20,
  },
  code: { color: colors.primary, fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  copyBtn: { padding: 8, backgroundColor: colors.primaryLight, borderRadius: colors.radiusSm },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgCard, borderRadius: colors.radiusSm,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  linkText: { flex: 1, color: colors.text2, fontSize: 12, fontFamily: 'Inter_400Regular' },
  shareBtn: {
    backgroundColor: colors.primary, borderRadius: colors.radius,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 12 },
  emptyText: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular' },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  refAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  refInfo: { flex: 1 },
  refName: { color: colors.text, fontSize: 14, fontFamily: 'Inter_500Medium' },
  refDate: { color: colors.text3, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  refBonus: { backgroundColor: colors.successLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  refBonusText: { color: colors.success, fontSize: 12, fontFamily: 'Inter_700Bold' },
});
