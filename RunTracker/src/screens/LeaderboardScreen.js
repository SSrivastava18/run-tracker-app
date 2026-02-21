// src/screens/LeaderboardScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listenToLeaderboard } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = listenToLeaderboard((data) => {
      setPlayers(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const renderItem = ({ item, index }) => {
    const isMe = item.uid === profile?.uid;
    return (
      <View style={[styles.row, isMe && styles.rowMe]}>
        <Text style={styles.rank}>{MEDALS[index] || `#${index + 1}`}</Text>
        <View style={[styles.avatar, { backgroundColor: item.color || '#5a6070' }]}>
          <Text style={styles.avatarTxt}>{(item.username || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, isMe && styles.nameMe]}>
            {item.username} {isMe ? '(you)' : ''}
          </Text>
          <Text style={styles.sub}>
            {(item.totalDistance / 1000).toFixed(1)} km · {item.totalSteps?.toLocaleString() || 0} steps
          </Text>
        </View>
        <View style={styles.zonesBadge}>
          <Text style={styles.zonesNum}>{item.zonesOwned || 0}</Text>
          <Text style={styles.zonesLbl}>zones</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>🏆 Leaderboard</Text>
      <Text style={styles.sub2}>Ranked by zones owned</Text>
      {loading ? (
        <ActivityIndicator color="#00f5a0" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No players yet. Go run!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0c10', padding: 20, paddingTop: 60 },
  title:  { color: '#e8eaf0', fontFamily: 'monospace', fontSize: 22, fontWeight: '900' },
  sub2:   { color: '#5a6070', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, marginBottom: 20, marginTop: 2 },

  row:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111419', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1f242e', gap: 10 },
  rowMe:  { borderColor: 'rgba(0,245,160,0.4)', backgroundColor: 'rgba(0,245,160,0.04)' },

  rank: { width: 28, textAlign: 'center', fontSize: 18 },

  avatar:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#000', fontWeight: '900', fontSize: 15, fontFamily: 'monospace' },

  info:   { flex: 1 },
  name:   { color: '#e8eaf0', fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  nameMe: { color: '#00f5a0' },
  sub:    { color: '#5a6070', fontFamily: 'monospace', fontSize: 9, marginTop: 2, letterSpacing: 0.5 },

  zonesBadge: { alignItems: 'center', backgroundColor: '#0a0c10', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#1f242e', minWidth: 48 },
  zonesNum:   { color: '#00f5a0', fontFamily: 'monospace', fontSize: 16, fontWeight: '900' },
  zonesLbl:   { color: '#5a6070', fontFamily: 'monospace', fontSize: 7, letterSpacing: 1 },

  empty: { color: '#5a6070', fontFamily: 'monospace', textAlign: 'center', marginTop: 40, fontSize: 12 },
});
