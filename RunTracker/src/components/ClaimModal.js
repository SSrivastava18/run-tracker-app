// src/components/ClaimModal.js
import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { polygonArea, polygonCentroid, formatDistance } from '../utils/geo';
import { claimZone, captureZone, updatePlayerStats } from '../services/firebase';

function formatDur(s) {
  const m   = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function ClaimModal({ visible, polygon, distance, elapsed, steps, profile, overlappingZone, onDone, onDiscard }) {
  const [loading, setLoading] = useState(false);

  const area = polygon ? polygonArea(polygon) : 0;
  const isChallenging = !!overlappingZone;

  const handleClaim = async () => {
    setLoading(true);
    try {
      const payload = {
        coordinates:     polygon,
        centroid:        polygonCentroid(polygon),
        ownerId:         profile.uid,
        ownerName:       profile.username,
        ownerColor:      profile.color,
        distance:        Math.round(distance),
        durationSeconds: elapsed,
        steps,
        area:            Math.round(area),
      };

      if (isChallenging) {
        // Try to capture existing zone
        const result = await captureZone(overlappingZone.id, { ...payload, uid: profile.uid, username: profile.username });
        if (result.success) {
          Alert.alert('🏆 Zone Captured!', `You took this zone! Reason: ${result.reason}`);
          // Update player stats
          await updatePlayerStats(profile.uid, {
            totalDistance: (profile.totalDistance || 0) + Math.round(distance),
            totalTime:     (profile.totalTime     || 0) + elapsed,
            totalSteps:    (profile.totalSteps    || 0) + steps,
            zonesOwned:    (profile.zonesOwned    || 0) + 1,
          });
        } else {
          Alert.alert('❌ Capture Failed', result.reason);
        }
      } else {
        // Fresh claim
        await claimZone(payload);
        await updatePlayerStats(profile.uid, {
          totalDistance: (profile.totalDistance || 0) + Math.round(distance),
          totalTime:     (profile.totalTime     || 0) + elapsed,
          totalSteps:    (profile.totalSteps    || 0) + steps,
          zonesOwned:    (profile.zonesOwned    || 0) + 1,
        });
        Alert.alert('⚑ Zone Claimed!', `"${profile.username}" now owns this territory!`);
      }
      onDone();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDiscard}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.flag}>⚑</Text>
            <Text style={styles.title}>
              {isChallenging ? 'CHALLENGE ZONE' : 'CLAIM ZONE'}
            </Text>
            <Text style={styles.sub}>
              {isChallenging
                ? `Currently owned by ${overlappingZone?.ownerName}`
                : 'Loop closed — this territory is yours to claim!'
              }
            </Text>
          </View>

          {/* Your run stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{formatDistance(distance)}</Text>
              <Text style={styles.statKey}>DISTANCE</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{formatDur(elapsed)}</Text>
              <Text style={styles.statKey}>TIME</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{steps.toLocaleString()}</Text>
              <Text style={styles.statKey}>STEPS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{(area / 1000).toFixed(1)}k</Text>
              <Text style={styles.statKey}>AREA m²</Text>
            </View>
          </View>

          {/* Challenger comparison */}
          {isChallenging && (
            <View style={styles.compareBox}>
              <Text style={styles.compareTitle}>OWNER'S RECORD</Text>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>Their Time</Text>
                  <Text style={styles.compareVal}>{formatDur(overlappingZone.durationSeconds)}</Text>
                </View>
                <Text style={styles.vs}>VS</Text>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>Your Time</Text>
                  <Text style={[styles.compareVal, elapsed < overlappingZone.durationSeconds && styles.winning]}>
                    {formatDur(elapsed)}
                    {elapsed < overlappingZone.durationSeconds ? ' ✓' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>Their Dist</Text>
                  <Text style={styles.compareVal}>{formatDistance(overlappingZone.distance)}</Text>
                </View>
                <Text style={styles.vs}>VS</Text>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>Your Dist</Text>
                  <Text style={[styles.compareVal, distance > overlappingZone.distance && styles.winning]}>
                    {formatDistance(distance)}
                    {distance > overlappingZone.distance ? ' ✓' : ''}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btns}>
            <TouchableOpacity style={styles.btnClaim} onPress={handleClaim} disabled={loading} activeOpacity={0.8}>
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.btnClaimTxt}>
                    {isChallenging ? '⚔ CHALLENGE!' : '⚑ CLAIM THIS ZONE'}
                  </Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDiscard} onPress={onDiscard} disabled={loading}>
              <Text style={styles.btnDiscardTxt}>✕ Discard Run</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#111419', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#1f242e' },

  header:   { alignItems: 'center', gap: 4 },
  flag:     { fontSize: 32 },
  title:    { color: '#e8eaf0', fontFamily: 'monospace', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  sub:      { color: '#5a6070', fontFamily: 'monospace', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox:   { flex: 1, backgroundColor: '#0a0c10', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1f242e' },
  statVal:   { color: '#00f5a0', fontFamily: 'monospace', fontSize: 15, fontWeight: '800' },
  statKey:   { color: '#5a6070', fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginTop: 2 },

  compareBox:   { backgroundColor: '#0a0c10', borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#1f242e' },
  compareTitle: { color: '#5a6070', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  compareRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareCol:   { flex: 1, alignItems: 'center' },
  compareLabel: { color: '#5a6070', fontFamily: 'monospace', fontSize: 8 },
  compareVal:   { color: '#e8eaf0', fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  winning:      { color: '#00f5a0' },
  vs:           { color: '#2a2f3a', fontFamily: 'monospace', fontSize: 11, width: 30, textAlign: 'center' },

  btns:         { gap: 10 },
  btnClaim:     { backgroundColor: '#00f5a0', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#00f5a0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnClaimTxt:  { color: '#000', fontFamily: 'monospace', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  btnDiscard:   { borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1f242e' },
  btnDiscardTxt:{ color: '#5a6070', fontFamily: 'monospace', fontSize: 12 },
});
