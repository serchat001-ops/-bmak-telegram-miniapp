import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/colors';

type Tab = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.includes('@')) return setError('Adresse email invalide');
    if (!password) return setError('Mot de passe requis');
    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.data?.error || 'Email ou mot de passe incorrect');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError('');
    if (!email.includes('@')) return setError('Adresse email invalide');
    if (name.length < 2) return setError('Nom trop court (min 2 caractères)');
    if (password.length < 6) return setError('Mot de passe trop court (min 6 caractères)');
    if (password !== password2) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await register(email.trim(), name.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.data?.error || 'Inscription échouée. Réessayez.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Ionicons name="link" size={36} color={colors.primary} />
          </View>
          <Text style={styles.logoTitle}>B_MAK</Text>
          <Text style={styles.logoSub}>Blockchain Rewards Platform</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => switchTab('login')}
            >
              <Text style={[styles.tabLabel, tab === 'login' && styles.tabLabelActive]}>Connexion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => switchTab('register')}
            >
              <Text style={[styles.tabLabel, tab === 'register' && styles.tabLabelActive]}>Inscription</Text>
            </TouchableOpacity>
          </View>

          {tab === 'login' ? (
            <View>
              <Text style={styles.desc}>Connectez-vous pour accéder à vos récompenses BMAK</Text>
              <Input
                placeholder="Adresse email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
              />
              <Input
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                icon="lock-closed-outline"
                rightIcon={showPass ? 'eye-off-outline' : 'eye-outline'}
                onRightPress={() => setShowPass(!showPass)}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitLabel}>Se connecter</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.desc}>Créez votre compte pour commencer à gagner des BMAK</Text>
              <Input
                placeholder="Adresse email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
              />
              <Input
                placeholder="Nom d'affichage (ex: CryptoKing)"
                value={name}
                onChangeText={setName}
                icon="person-outline"
              />
              <Input
                placeholder="Mot de passe (min. 6 caractères)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                icon="lock-closed-outline"
                rightIcon={showPass ? 'eye-off-outline' : 'eye-outline'}
                onRightPress={() => setShowPass(!showPass)}
              />
              <Input
                placeholder="Confirmer le mot de passe"
                value={password2}
                onChangeText={setPassword2}
                secureTextEntry={!showPass}
                icon="lock-closed-outline"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitLabel}>Créer mon compte</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({
  placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, icon, rightIcon, onRightPress,
}: any) {
  return (
    <View style={inputStyles.wrapper}>
      <Ionicons name={icon} size={18} color={colors.text2} style={inputStyles.leftIcon} />
      <TextInput
        style={inputStyles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'sentences'}
        autoCorrect={false}
      />
      {rightIcon && onRightPress && (
        <TouchableOpacity onPress={onRightPress} style={inputStyles.rightIcon}>
          <Ionicons name={rightIcon} size={18} color={colors.text2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: colors.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  leftIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
  },
  rightIcon: { padding: 4 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, flexGrow: 1 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoTitle: { color: colors.text, fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  logoSub: { color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: colors.radiusXl,
    borderWidth: 1, borderColor: colors.border,
    padding: 20,
  },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: colors.radiusSm, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.primary },
  tabLabel: { color: colors.text2, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabLabelActive: { color: colors.text },
  desc: { color: colors.text2, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 12, textAlign: 'center' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: colors.radiusSm,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitLabel: { color: colors.text, fontSize: 16, fontFamily: 'Inter_700Bold' },
});
