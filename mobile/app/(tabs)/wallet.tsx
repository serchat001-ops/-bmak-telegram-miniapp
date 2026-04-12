import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, fmtNum, shorten } from '@/lib/api';
import { colors } from '@/constants/colors';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user, config, updateUser } = useAuth();
  const [walletInput, setWalletInput] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [saving, setSaving] = useState(false);

  const bal = parseFloat(user?.bmak_balance || '0');
  const hasWallet = !!user?.wallet_address;

  async function saveWallet() {
    if (!walletInput.startsWith('0x') || walletInput.length !== 42) {
      Alert.alert('Erreur', 'Adresse BSC invalide (doit commencer par 0x et avoir 42 caractères)');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/users/wallet', 'POST', { userId: user?.id, walletAddress: walletInput });
      if (user) updateUser({ ...user, wallet_address: walletInput });
      setShowConnect(false);
      setWalletInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le wallet');
    } finally {
      setSaving(false);
    }
  }

  async function copyAddress() {
    if (user?.wallet_address) {
      await Clipboard.setStringAsync(user.wallet_address);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Copié !', 'Adresse copiée dans le presse-papiers');
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0), paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.walletCard}>
        <Text style={styles.cardLabel}>Wallet</Text>
        <Text style={styles.balanceBig}>{fmtNum(bal)} BMAK</Text>
        <View style={styles.addrRow}>
          <Ionicons name="wallet-outline" size={14} color={colors.text2} />
          <Text style={styles.addrText}>
            {hasWallet ? shorten(user!.wallet_address) : 'Aucun wallet connecté'}
          </Text>
        </View>
        <View style={styles.btnRow}>
          <WalletBtn icon="link" label="Connecter" onPress={() => setShowConnect(true)} primary />
          <WalletBtn
            icon="arrow-down"
            label="Recevoir"
            onPress={() => {
              if (!hasWallet) { Alert.alert('Wallet requis', 'Connectez d\'abord un wallet'); return; }
              setShowReceive(true);
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actifs</Text>
        <View style={styles.assetCard}>
          <View style={[styles.assetIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="diamond" size={22} color={colors.primary} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>BMAK Token</Text>
            <Text style={styles.assetSub}>BSC Network</Text>
          </View>
          <View style={styles.assetRight}>
            <Text style={styles.assetBal}>{fmtNum(bal)}</Text>
            <Text style={styles.assetUsd}>Solde in-app</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Réseau</Text>
        <View style={styles.networkCard}>
          <NetRow label="Réseau" value="BSC Mainnet" />
          <NetRow label="Chain ID" value="56" />
          <NetRow label="Contrat" value={config?.contractAddress ? shorten(config.contractAddress) : 'Non configuré'} />
          <NetRow label="Symbole" value={config?.tokenSymbol || 'BMAK'} last />
        </View>
      </View>

      <Modal visible={showConnect} transparent animationType="slide" onRequestClose={() => setShowConnect(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Connecter un Wallet</Text>
            <Text style={modal.desc}>Entrez votre adresse BSC (BNB Smart Chain)</Text>
            <TextInput
              style={modal.input}
              placeholder="0x..."
              placeholderTextColor={colors.text3}
              value={walletInput}
              onChangeText={setWalletInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={modal.btn} onPress={saveWallet} disabled={saving}>
              <Text style={modal.btnText}>{saving ? 'Sauvegarde...' : 'Connecter'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.cancel} onPress={() => setShowConnect(false)}>
              <Text style={modal.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showReceive} transparent animationType="slide" onRequestClose={() => setShowReceive(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Recevoir BMAK</Text>
            <View style={modal.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={80} color={colors.text3} />
            </View>
            <Text style={modal.addrFull}>{user?.wallet_address}</Text>
            <TouchableOpacity style={modal.btn} onPress={copyAddress}>
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={modal.btnText}>Copier l'adresse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.cancel} onPress={() => setShowReceive(false)}>
              <Text style={modal.cancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function WalletBtn({ icon, label, onPress, primary }: any) {
  return (
    <TouchableOpacity style={[wbStyles.btn, primary && wbStyles.primary]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={18} color={primary ? '#fff' : colors.text} />
      <Text style={[wbStyles.label, primary && wbStyles.labelPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NetRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[netStyles.row, !last && netStyles.border]}>
      <Text style={netStyles.label}>{label}</Text>
      <Text style={netStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  walletCard: {
    margin: 16,
    background: 'linear-gradient(135deg, #1a1a2e, #13131f)' as any,
    backgroundColor: colors.bgCard,
    borderRadius: colors.radiusXl,
    borderWidth: 1, borderColor: colors.border,
    padding: 24,
  },
  cardLabel: { color: colors.text2, fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 1, marginBottom: 8 },
  balanceBig: { color: colors.text, fontSize: 36, fontFamily: 'Inter_700Bold', letterSpacing: -1, marginBottom: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  addrText: { color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular' },
  btnRow: { flexDirection: 'row', gap: 10 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bgCard, borderRadius: colors.radius,
    borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  assetIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  assetInfo: { flex: 1 },
  assetName: { color: colors.text, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  assetSub: { color: colors.text3, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  assetRight: { alignItems: 'flex-end' },
  assetBal: { color: colors.text, fontSize: 15, fontFamily: 'Inter_700Bold' },
  assetUsd: { color: colors.text3, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  networkCard: { backgroundColor: colors.bgCard, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});

const wbStyles = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: colors.radiusSm, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  labelPrimary: { color: '#fff' },
});

const netStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular' },
  value: { color: colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { color: colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  desc: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: colors.radiusSm,
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, padding: 14, fontSize: 15,
    fontFamily: 'Inter_400Regular', marginBottom: 16,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: colors.radiusSm,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, marginBottom: 10,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: colors.text2, fontSize: 15, fontFamily: 'Inter_500Medium' },
  qrPlaceholder: { alignItems: 'center', paddingVertical: 24 },
  addrFull: {
    color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular',
    textAlign: 'center', marginBottom: 20, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: colors.radiusSm,
  },
});
