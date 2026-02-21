// src/screens/MapScreen.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, SafeAreaView, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import useTracking from '../hooks/useTracking';
import { useAuth } from '../hooks/useAuth';
import RunHUD from '../components/RunHUD';
import ClaimModal from '../components/ClaimModal';
import { listenToZones } from '../services/firebase';
import { pointInPolygon, polygonCentroid } from '../utils/geo';

// Dark map style
const DARK_MAP = [
  { elementType: 'geometry',            stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#4a5060' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d1117' }] },
  { featureType: 'road',          elementType: 'geometry',        stylers: [{ color: '#1a2030' }] },
  { featureType: 'road.highway',  elementType: 'geometry',        stylers: [{ color: '#253040' }] },
  { featureType: 'water',         elementType: 'geometry',        stylers: [{ color: '#060b12' }] },
  { featureType: 'poi',           stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',       stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',elementType: 'geometry.stroke', stylers: [{ color: '#1a2030' }] },
];

export default function MapScreen() {
  const { profile } = useAuth();
  const {
    PHASE, phase, location, pathPoints,
    distance, steps, elapsed, accuracy, loopPoints,
    startTracking, stopTracking, resetTracking,
    beginClaiming, finishClaiming,
  } = useTracking();

  const mapRef     = useRef(null);
  const firstFix   = useRef(true);
  const [zones,     setZones]     = useState([]);
  const [mapType,   setMapType]   = useState('standard');
  const [showClaim, setShowClaim] = useState(false);

  // Real-time zone listener
  useEffect(() => {
    const unsub = listenToZones(setZones);
    return unsub;
  }, []);

  // Auto-center on first GPS fix
  useEffect(() => {
    if (location && firstFix.current && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:       location.latitude,
        longitude:      location.longitude,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      }, 800);
      firstFix.current = false;
    }
  }, [location]);

  // When loop closes, show claim modal
  useEffect(() => {
    if (phase === PHASE.LOOP && loopPoints) {
      setShowClaim(true);
    }
  }, [phase, loopPoints]);

  // Find any zone that overlaps the current loopPoints centroid
  const overlappingZone = useCallback(() => {
    if (!loopPoints) return null;
    const centroid = polygonCentroid(loopPoints);
    return zones.find((z) =>
      z.ownerId !== profile?.uid &&
      z.coordinates &&
      pointInPolygon(centroid, z.coordinates)
    ) || null;
  }, [loopPoints, zones, profile]);

  const handleStartStop = async () => {
    if (phase === PHASE.IDLE) {
      try {
        firstFix.current = true;
        await startTracking();
      } catch (e) {
        Alert.alert('Error', e.message);
      }
    } else if (phase === PHASE.RUNNING) {
      Alert.alert('Stop Run?', 'Loop not closed yet. Your zone will not be saved.', [
        { text: 'Keep Running', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: stopTracking },
      ]);
    }
  };

  const handleClaimDone = () => {
    setShowClaim(false);
    finishClaiming();
    resetTracking();
  };

  const handleClaimDiscard = () => {
    setShowClaim(false);
    resetTracking();
  };

  const centerOnMe = () => {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude:       location.latitude,
      longitude:      location.longitude,
      latitudeDelta:  0.004,
      longitudeDelta: 0.004,
    }, 500);
  };

  const isRunning = phase === PHASE.RUNNING;
  const isLoop    = phase === PHASE.LOOP;

  return (
    <View style={styles.container}>

      {/* ── MAP ─────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP}
        mapType={mapType}
        showsCompass={false}
        toolbarEnabled={false}
        initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 }}
      >
        {/* All claimed zones */}
        {zones.map((zone) => (
          <React.Fragment key={zone.id}>
            <Polygon
              coordinates={zone.coordinates}
              fillColor={`${zone.ownerColor || '#00f5a0'}22`}
              strokeColor={zone.ownerColor || '#00f5a0'}
              strokeWidth={2}
            />
            {/* Owner label at centroid */}
            {zone.centroid && (
              <Marker coordinate={zone.centroid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.zoneLabel, { borderColor: zone.ownerColor || '#00f5a0' }]}>
                  <Text style={styles.zoneLabelFlag}>⚑</Text>
                  <Text style={[styles.zoneLabelTxt, { color: zone.ownerColor || '#00f5a0' }]}>
                    {zone.ownerName}
                  </Text>
                </View>
              </Marker>
            )}
          </React.Fragment>
        ))}

        {/* Current run path */}
        {pathPoints.length > 1 && (
          <Polyline
            coordinates={pathPoints}
            strokeColor={isLoop ? '#ffd166' : '#00f5a0'}
            strokeWidth={3}
          />
        )}

        {/* Closed loop polygon preview */}
        {loopPoints && (
          <Polygon
            coordinates={loopPoints}
            fillColor="rgba(255,209,102,0.15)"
            strokeColor="#ffd166"
            strokeWidth={2}
          />
        )}

        {/* Live position marker */}
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.markerRing, { borderColor: profile?.color || '#00f5a0' }]}>
              <View style={[styles.markerDot, { backgroundColor: profile?.color || '#00f5a0' }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={[styles.logoDot, isRunning && styles.logoDotLive]} />
            <Text style={styles.logoTxt}>
              Zone<Text style={{ color: '#00f5a0' }}>Wars</Text>
            </Text>
          </View>
          <View style={styles.topRight}>
            {/* Map type */}
            <View style={styles.mapTypePill}>
              {['standard', 'satellite'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.mapTypeOpt, mapType === t && styles.mapTypeOptActive]}
                  onPress={() => setMapType(t)}
                >
                  <Text style={[styles.mapTypeOptTxt, mapType === t && styles.mapTypeOptTxtActive]}>
                    {t === 'standard' ? '🗺' : '🛰'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Center */}
            <TouchableOpacity style={styles.centerBtn} onPress={centerOnMe}>
              <Text style={styles.centerBtnTxt}>◎</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── BOTTOM PANEL ────────────────────────────────────── */}
      <SafeAreaView style={styles.bottomSafe}>
        <View style={styles.bottom}>

          {/* Hint text */}
          {isRunning && (
            <View style={styles.hintBox}>
              <Text style={styles.hintTxt}>
                🏃 Run a loop and return within 20m of your start to claim a zone
              </Text>
            </View>
          )}

          <RunHUD
            distance={distance}
            elapsed={elapsed}
            steps={steps}
            accuracy={accuracy}
            phase={phase}
          />

          {/* Start / Stop button */}
          <TouchableOpacity
            style={[styles.mainBtn, isRunning ? styles.mainBtnStop : styles.mainBtnStart]}
            onPress={handleStartStop}
            activeOpacity={0.85}
          >
            <Text style={[styles.mainBtnTxt, isRunning && { color: '#ff4d6d' }]}>
              {isRunning ? '■  STOP RUN' : '▶  START RUN'}
            </Text>
          </TouchableOpacity>

          {/* Zone count */}
          <Text style={styles.zoneCount}>
            {zones.length} zone{zones.length !== 1 ? 's' : ''} claimed worldwide
          </Text>

        </View>
      </SafeAreaView>

      {/* ── CLAIM MODAL ─────────────────────────────────────── */}
      <ClaimModal
        visible={showClaim}
        polygon={loopPoints}
        distance={distance}
        elapsed={elapsed}
        steps={steps}
        profile={profile}
        overlappingZone={overlappingZone()}
        onDone={handleClaimDone}
        onDiscard={handleClaimDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0c10' },

  // Zone labels
  zoneLabel:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(10,12,16,0.88)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  zoneLabelFlag:{ fontSize: 9 },
  zoneLabelTxt: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },

  // Marker
  markerRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  markerDot:  { width: 10, height: 10, borderRadius: 5 },

  // Top bar
  topSafe:  { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(10,12,16,0.88)', borderBottomWidth: 1, borderBottomColor: '#1f242e' },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5a6070' },
  logoDotLive: { backgroundColor: '#00f5a0' },
  logoTxt:  { color: '#e8eaf0', fontFamily: 'monospace', fontSize: 18, fontWeight: '900' },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  mapTypePill:       { flexDirection: 'row', backgroundColor: '#111419', borderRadius: 10, borderWidth: 1, borderColor: '#1f242e', overflow: 'hidden' },
  mapTypeOpt:        { paddingHorizontal: 10, paddingVertical: 6 },
  mapTypeOptActive:  { backgroundColor: '#1f242e' },
  mapTypeOptTxt:     { fontSize: 14 },
  mapTypeOptTxtActive: {},

  centerBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#111419', borderWidth: 1, borderColor: '#1f242e', alignItems: 'center', justifyContent: 'center' },
  centerBtnTxt: { color: '#00b8d9', fontSize: 16 },

  // Bottom
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottom:     { backgroundColor: 'rgba(10,12,16,0.96)', borderTopWidth: 1, borderTopColor: '#1f242e', padding: 16, gap: 10 },

  hintBox: { backgroundColor: 'rgba(0,245,160,0.06)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(0,245,160,0.2)' },
  hintTxt: { color: '#00f5a0', fontFamily: 'monospace', fontSize: 10, textAlign: 'center', letterSpacing: 0.3 },

  mainBtn:      { borderRadius: 14, padding: 16, alignItems: 'center' },
  mainBtnStart: { backgroundColor: '#00f5a0', shadowColor: '#00f5a0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  mainBtnStop:  { backgroundColor: 'rgba(255,77,109,0.08)', borderWidth: 1.5, borderColor: '#ff4d6d' },
  mainBtnTxt:   { color: '#000', fontFamily: 'monospace', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  zoneCount: { color: '#2a2f3a', fontFamily: 'monospace', fontSize: 9, textAlign: 'center', letterSpacing: 1 },
});
