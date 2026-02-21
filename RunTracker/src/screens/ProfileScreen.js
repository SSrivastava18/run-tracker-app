// src/screens/ProfileScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { logoutUser } from '../services/firebase';

function StatCard({ icon, value, label }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardVal}>{value}</Text>
      <Text style={styles.cardLbl}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile } = useAuth();
  if (!profile) return null;

  const km    = ((profile.totalDistance || 0) / 1000).toFixed(2);
  const time  = profile.totalTime || 0;
  const h     = Math.floor(time / 3600);
  const m     = Math.floor((time % 3600) / 60);
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const logout = async () => {
    Alert.alert('Sign out?', 'You will be signed out of ZoneWars.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logoutUser },
    ]);
  };

  return (
    <View style={styles.screen}>

      {/* Avatar */}
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: profile.color }]}>
          <Text style={styles.avatarTxt}>{profile.username[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <View style={[styles.badge, { borderColor: profile.color }]}>
          <Text style={[styles.badgeTxt, { color: profile.color }]}>
            {(profile.zonesOwned || 0)} ZONES OWNED
          </Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={styles.sectionLabel}>LIFETIME STATS</Text>
      <View style={styles.grid}>
        <StatCard icon="📍" value={`${km} km`}                              label="DISTANCE"  />
        <StatCard icon="⏱"  value={timeStr}                                 label="TIME"      />
        <StatCard icon="👟" value={(profile.totalSteps || 0).toLocaleString()} label="STEPS"    />
        <StatCard icon="⚑"  value={String(profile.zonesOwned || 0)}         label="ZONES"     />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutTxt}>↩  SIGN OUT</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0c10', padding: 24, paddingTop: 60 },

  hero:       { alignItems: 'center', marginBottom: 32, gap: 8 },
  avatar:     { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarTxt:  { color: '#000', fontSize: 32, fontWeight: '900', fontFamily: 'monospace' },
  username:   { color: '#e8eaf0', fontSize: 22, fontWeight: '900', fontFamily: 'monospace' },
  email:      { color: '#5a6070', fontSize: 11, fontFamily: 'monospace' },
  badge:      { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, marginTop: 4 },
  badgeTxt:   { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sectionLabel: { color: '#5a6070', fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  card: { flex: 1, minWidth: '45%', backgroundColor: '#111419', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#1f242e' },
  cardIcon: { fontSize: 22 },
  cardVal:  { color: '#00f5a0', fontFamily: 'monospace', fontSize: 18, fontWeight: '900' },
  cardLbl:  { color: '#5a6070', fontFamily: 'monospace', fontSize: 8, letterSpacing: 1 },

  logoutBtn: { borderWidth: 1, borderColor: '#1f242e', borderRadius: 14, padding: 14, alignItems: 'center' },
  logoutTxt: { color: '#5a6070', fontFamily: 'monospace', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
});
