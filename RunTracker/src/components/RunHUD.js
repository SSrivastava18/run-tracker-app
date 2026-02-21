// src/components/RunHUD.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function Stat({ icon, label, value, accent }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}` : `${Math.round(m)}`;
}

function formatDistUnit(m) {
  return m >= 1000 ? 'km' : 'm';
}

export default function RunHUD({ distance, elapsed, steps, accuracy, phase }) {
  const isRunning = phase === 'RUNNING';
  return (
    <View style={styles.hud}>
      {/* Phase badge */}
      <View style={[styles.phaseBadge, isRunning ? styles.phaseLive : styles.phaseIdle]}>
        <View style={[styles.phaseDot, isRunning && styles.phaseDotLive]} />
        <Text style={[styles.phaseTxt, isRunning && styles.phaseTxtLive]}>
          {phase === 'RUNNING' ? 'RECORDING ZONE' : phase === 'LOOP' ? 'LOOP CLOSED ✓' : 'READY'}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.row}>
        <Stat
          icon="📍"
          label={formatDistUnit(distance)}
          value={formatDist(distance)}
          accent="#00f5a0"
        />
        <View style={styles.divider} />
        <Stat
          icon="⏱"
          label="time"
          value={formatTime(elapsed)}
          accent="#00b8d9"
        />
        <View style={styles.divider} />
        <Stat
          icon="👟"
          label="steps"
          value={steps.toLocaleString()}
          accent="#ffd166"
        />
      </View>

      {/* Accuracy */}
      {accuracy != null && (
        <Text style={styles.acc}>GPS ±{Math.round(accuracy)}m</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    backgroundColor: 'rgba(10,12,16,0.94)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f242e',
    gap: 10,
  },
  phaseBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#1f242e', backgroundColor: '#111419',
  },
  phaseLive: { borderColor: 'rgba(0,245,160,0.4)', backgroundColor: 'rgba(0,245,160,0.06)' },
  phaseIdle: {},
  phaseDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5a6070' },
  phaseDotLive: { backgroundColor: '#00f5a0' },
  phaseTxt:     { fontFamily: 'monospace', fontSize: 9, color: '#5a6070', letterSpacing: 1 },
  phaseTxtLive: { color: '#00f5a0' },

  row:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  divider: { width: 1, height: 36, backgroundColor: '#1f242e' },

  stat:  { alignItems: 'center', flex: 1 },
  icon:  { fontSize: 14, marginBottom: 2 },
  value: { fontFamily: 'monospace', fontSize: 20, fontWeight: '800', color: '#e8eaf0' },
  label: { fontFamily: 'monospace', fontSize: 8, color: '#5a6070', letterSpacing: 1, marginTop: 1 },

  acc: { textAlign: 'center', fontFamily: 'monospace', fontSize: 9, color: '#3a3f4a', letterSpacing: 0.5 },
});
