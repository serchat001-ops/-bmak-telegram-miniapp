import React from 'react';
import { View, Text, FlatList, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, formatTime } from '@/lib/api';
import { colors } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';

const TX_ICONS: Record<string, any> = {
  checkin: 'calendar', referral: 'people', send: 'arrow-up',
  receive: 'arrow-down', payout: 'cash', admin_credit: 'add-circle', admin_debit: 'remove-circle',
};
const TX_LABELS: Record<string, string> = {
  checkin: 'Récompense quotidienne', referral: 'Bonus parrainage',
  send: 'Envoi', receive: 'Réception', payout: 'Paiement',
  admin_credit: 'Crédit admin', admin_debit: 'Débit admin',
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/transactions', user?.id, 'all'],
    queryFn: () => apiFetch(`/api/transactions/${user?.id}?limit=100`),
    enabled: !!user?.id,
  });

  const txs: any[] = data?.transactions || [];

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 16,
        flexGrow: 1,
      }}
      data={txs}
      keyExtractor={(_, i) => String(i)}
      scrollEnabled={txs.length > 0}
      ListHeaderComponent={
        <Text style={styles.header}>Historique</Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={colors.text3} />
          <Text style={styles.emptyTitle}>Aucune activité</Text>
          <Text style={styles.emptyText}>Vos transactions apparaîtront ici.</Text>
        </View>
      }
      renderItem={({ item: tx }) => {
        const isSend = tx.type === 'send' || tx.type === 'admin_debit' || tx.type === 'payout';
        const amt = parseFloat(tx.amount);
        return (
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: isSend ? colors.dangerLight : colors.successLight }]}>
              <Ionicons name={TX_ICONS[tx.type] || 'diamond'} size={18} color={isSend ? colors.danger : colors.success} />
            </View>
            <View style={styles.info}>
              <Text style={styles.type}>{TX_LABELS[tx.type] || tx.type}</Text>
              {tx.description ? <Text style={styles.desc} numberOfLines={1}>{tx.description}</Text> : null}
              <Text style={styles.time}>{formatTime(tx.created_at)}</Text>
            </View>
            <Text style={[styles.amt, isSend ? styles.neg : styles.pos]}>
              {isSend ? '-' : '+'}{amt.toLocaleString()} BMAK
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { color: colors.text, fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  type: { color: colors.text, fontSize: 14, fontFamily: 'Inter_500Medium' },
  desc: { color: colors.text3, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  time: { color: colors.text3, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  amt: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pos: { color: colors.success },
  neg: { color: colors.danger },
});
