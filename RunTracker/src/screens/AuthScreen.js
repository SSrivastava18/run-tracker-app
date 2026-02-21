// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { registerUser, loginUser } from '../services/firebase';

export default function AuthScreen() {
  const [mode,     setMode]     = useState('login');   // 'login' | 'register'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    if (!email || !password || (mode === 'register' && !username)) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') await registerUser(email.trim(), password, username.trim());
      else await loginUser(email.trim(), password);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>
            Zone<Text style={styles.logoAccent}>Wars</Text>
          </Text>
          <Text style={styles.logoSub}>Run • Claim • Conquer</Text>
        </View>

        {/* Tab */}
        <View style={styles.tabs}>
          {['login', 'register'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.tabTxt, mode === m && styles.tabTxtActive]}>
                {m === 'login' ? 'SIGN IN' : 'REGISTER'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.card}>
          {mode === 'register' && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="YourRunnerName"
                placeholderTextColor="#3a3f4a"
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#3a3f4a"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#3a3f4a"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnTxt}>{mode === 'login' ? '▶  ENTER THE ARENA' : '⚑  CREATE ACCOUNT'}</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.foot}>
          Territory capture game · Real-time multiplayer
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0a0c10' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoDot:   { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00f5a0', marginBottom: 10, shadowColor: '#00f5a0', shadowRadius: 12, shadowOpacity: 0.8 },
  logoText:  { color: '#e8eaf0', fontSize: 36, fontWeight: '900', fontFamily: 'monospace', letterSpacing: -1 },
  logoAccent:{ color: '#00f5a0' },
  logoSub:   { color: '#5a6070', fontFamily: 'monospace', fontSize: 11, marginTop: 4, letterSpacing: 2 },

  tabs:        { flexDirection: 'row', marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1f242e' },
  tab:         { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#111419' },
  tabActive:   { backgroundColor: '#1f242e' },
  tabTxt:      { color: '#5a6070', fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tabTxtActive:{ color: '#00f5a0' },

  card:       { backgroundColor: '#111419', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1f242e', gap: 14 },
  inputWrap:  {},
  inputLabel: { color: '#5a6070', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 6 },
  input:      { backgroundColor: '#0a0c10', borderWidth: 1, borderColor: '#1f242e', borderRadius: 10, padding: 12, color: '#e8eaf0', fontFamily: 'monospace', fontSize: 14 },

  btn:    { backgroundColor: '#00f5a0', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4, shadowColor: '#00f5a0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnTxt: { color: '#000', fontFamily: 'monospace', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  foot: { color: '#2a2f3a', fontFamily: 'monospace', fontSize: 10, textAlign: 'center', marginTop: 24, letterSpacing: 1 },
});
