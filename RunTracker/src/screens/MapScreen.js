// src/screens/MapScreen.js
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Polygon,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import useTracking from "../hooks/useTracking";
import { useAuth } from "../hooks/useAuth";
import RunHUD from "../components/RunHUD";
import ClaimModal from "../components/ClaimModal";
import { listenToZones } from "../services/firebase";
import { claimZone, captureZone, formatDuration } from "../services/firebase";
import { pointInPolygon, polygonCentroid } from "../utils/geo";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "react-native";

// Dark map style
const DARK_MAP = [
  { elementType: "geometry", stylers: [{ color: "#0d1117" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5060" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1117" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1a2030" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#253040" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#060b12" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1a2030" }],
  },
];

export default function MapScreen() {
  const { profile } = useAuth();
  const {
    PHASE,
    phase,
    location,
    pathPoints,
    distance,
    steps,
    elapsed,
    accuracy,
    loopPoints,
    startTracking,
    stopTracking,
    resetTracking,
    beginClaiming,
    finishClaiming,
  } = useTracking();

  const mapRef = useRef(null);
  const firstFix = useRef(true);
  const [zones, setZones] = useState([]);
  const [mapType, setMapType] = useState("standard");
  const [showClaim, setShowClaim] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);

  // Real-time zone listener
  useEffect(() => {
    const unsub = listenToZones(setZones);
    return unsub;
  }, []);

  // Auto-center on first GPS fix
  useEffect(() => {
    if (location && firstFix.current && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        800,
      );
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
    return (
      zones.find(
        (z) =>
          z.ownerId !== profile?.uid &&
          z.coordinates &&
          pointInPolygon(centroid, z.coordinates),
      ) || null
    );
  }, [loopPoints, zones, profile]);

  const handleStartStop = async () => {
    if (phase === PHASE.IDLE) {
      try {
        firstFix.current = true;
        await startTracking();
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    } else if (phase === PHASE.RUNNING) {
      Alert.alert(
        "Stop Run?",
        "Loop not closed yet. Your zone will not be saved.",
        [
          { text: "Keep Running", style: "cancel" },
          { text: "Stop", style: "destructive", onPress: stopTracking },
        ],
      );
    }
  };

  const handleClaimDone = async () => {
    try {
      const zonePayload = buildZonePayload();
      const existing = overlappingZone();

      if (!zonePayload) return;

      if (!existing) {
        await claimZone(zonePayload);
        Alert.alert("Zone claimed!", "You now own this Territory.");
      } else {
        const result = await captureZone(existing.id, {
          uid: profile.uid,
          username: profile.username,
          color: profile.color,
          distance,
          durationSeconds: elapsed,
        });

        if (result.success) {
          Alert.alert("Zone Captured!", result.reason);
        } else {
          Alert.alert("Challenge Failed", result.reason);
        }
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }

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
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      500,
    );
  };

  const isRunning = phase === PHASE.RUNNING;
  const isLoop = phase === PHASE.LOOP;

  const buildZonePayload = () => {
    if (!loopPoints || !profile) return null;

    return {
      ownerId: profile.uid,
      ownerName: profile.username,
      ownerColor: profile.color,
      coordinates: loopPoints,
      centroid: polygonCentroid(loopPoints),
      distance,
      durationSeconds: elapsed,
    };
  };

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
        initialRegion={{
          latitude: 20,
          longitude: 0,
          latitudeDelta: 80,
          longitudeDelta: 80,
        }}
      >
        {/* All claimed zones */}
        {zones.map((zone) => (
          <React.Fragment key={zone.id}>
            <Polygon
              coordinates={zone.coordinates}
              fillColor={`${zone.ownerColor || "#00f5a0"}22`}
              strokeColor={zone.ownerColor || "#00f5a0"}
              strokeWidth={2}
            />
            {/* Owner label at centroid */}
            {zone.centroid && (
              <Marker
                coordinate={zone.centroid}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => setSelectedZone(zone)}
                tracksViewChanges={false}
              >
                <View style={styles.pinWrapper}>
                  <View
                    style={[
                      styles.pinStem,
                      { backgroundColor: zone.ownerColor },
                    ]}
                  />

                  <View
                    style={[styles.pinBadge, { borderColor: zone.ownerColor }]}
                  >
                    {zone.ownerAvatar ? (
                      <Image
                        source={{ uri: zone.ownerAvatar }}
                        style={styles.pinAvatar}
                      />
                    ) : (
                      <Text
                        style={[styles.pinInitial, { color: zone.ownerColor }]}
                      >
                        {zone.ownerName?.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </Marker>
            )}
          </React.Fragment>
        ))}

        {/* Current run path */}
        {pathPoints.length > 1 && (
          <Polyline
            coordinates={pathPoints}
            strokeColor={isLoop ? "#ffd166" : "#00f5a0"}
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
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.markerRing,
                { borderColor: profile?.color || "#00f5a0" },
              ]}
            >
              <View
                style={[
                  styles.markerDot,
                  { backgroundColor: profile?.color || "#00f5a0" },
                ]}
              />
            </View>
          </Marker>
        )}
      </MapView>

      {selectedZone && (
        <View style={styles.zoneDetail}>
          <Text style={styles.zoneOwner}>⚑ {selectedZone.ownerName}</Text>

          <Text style={styles.zoneStat}>
            Distance Record: {Math.round(selectedZone.distance)} m
          </Text>

          <Text style={styles.zoneStat}>
            Time Record: {formatDuration(selectedZone.durationSeconds)}
          </Text>

          <Text style={styles.zoneChallenge}>
            To Capture: Run further OR faster
          </Text>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setSelectedZone(null)}
          >
            <Text style={{ color: "#fff" }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <BlurView intensity={40} tint="dark" style={styles.glassWrap}>
          <LinearGradient
            colors={[
              "rgba(255,140,0,0.45)",
              "rgba(255,94,0,0.25)",
              "rgba(255,50,0,0.12)",
              "transparent",
            ]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <View style={[styles.logoDot, isRunning && styles.logoDotLive]} />
              <Text style={styles.logoTxt}>
                Zone<Text style={{ color: "#f57f00" }}>Wars</Text>
              </Text>
            </View>
            <View style={styles.topRight}>
              {/* Map type */}
              <View style={styles.mapTypePill}>
                {["standard", "satellite"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.mapTypeOpt,
                      mapType === t && styles.mapTypeOptActive,
                    ]}
                    onPress={() => setMapType(t)}
                  >
                    <Text
                      style={[
                        styles.mapTypeOptTxt,
                        mapType === t && styles.mapTypeOptTxtActive,
                      ]}
                    >
                      {t === "standard" ? "🗺" : "🛰"}
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
        </BlurView>
        {/* </BlurView> */}
      </SafeAreaView>

      {/* ── BOTTOM PANEL ────────────────────────────────────── */}
      <SafeAreaView style={styles.bottomSafe}>
        <BlurView intensity={40} tint="dark" style={styles.glassWrap}>
          <LinearGradient
            colors={[
              "rgba(255,140,0,0.45)",
              "rgba(255,94,0,0.25)",
              "rgba(255,50,0,0.12)",
              "transparent",
            ]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.bottom}>
            {/* Hint text */}
            {isRunning && (
              <View style={styles.hintBox}>
                <Text style={styles.hintTxt}>
                  🏃 Run a loop and return within 20m of your start to claim a
                  zone
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
              style={[
                styles.mainBtn,
                isRunning ? styles.mainBtnStop : styles.mainBtnStart,
              ]}
              onPress={handleStartStop}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.mainBtnTxt, isRunning && { color: "#ff4d6d" }]}
              >
                {isRunning ? "■  STOP RUN" : "▶  START RUN"}
              </Text>
            </TouchableOpacity>

            {/* Zone count */}
            <Text style={styles.zoneCount}>
              {zones.length} zone{zones.length !== 1 ? "s" : ""} claimed
              worldwide
            </Text>
          </View>
        </BlurView>
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
  container: { flex: 1, backgroundColor: "#0a0c10" },

  // Zone labels
  zoneLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(10,12,16,0.88)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  zoneLabelFlag: { fontSize: 9 },
  zoneLabelTxt: { fontFamily: "monospace", fontSize: 10, fontWeight: "700" },

  // Marker
  markerRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  markerDot: { width: 10, height: 10, borderRadius: 5 },

  flagContainer: {
    alignItems: "center",
  },

  flagPole: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },

  flag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },

  flagText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  zoneDetail: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    backgroundColor: "rgba(10,12,16,0.95)",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#333",
    zIndex: 10
  },

  zoneOwner: {
    color: "#f57f00",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  zoneStat: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 6,
  },

  zoneChallenge: {
    color: "#00f5a0",
    marginTop: 10,
  },

  closeBtn: {
    marginTop: 15,
    alignSelf: "flex-end",
  },

  pinWrapper: {
    alignItems: "center",
  },

  pinStem: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },

  pinBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0a0c10",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 4,
  },

  pinAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 17,
  },

  pinInitial: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Top bar
  topSafe: { position: "absolute", top: 15, left: 0, right: 0 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(10,12,16,0.88)",
    borderBottomWidth: 1,
    borderBottomColor: "#1f242e",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#5a6070",
  },
  logoDotLive: { backgroundColor: "#f57f00" },
  logoTxt: {
    color: "#e8eaf0",
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "900",
  },
  topRight: { flexDirection: "row", gap: 8, alignItems: "center" },

  mapTypePill: {
    flexDirection: "row",
    backgroundColor: "#111419",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f242e",
    overflow: "hidden",
  },
  mapTypeOpt: { paddingHorizontal: 10, paddingVertical: 6 },
  mapTypeOptActive: { backgroundColor: "#1f242e" },
  mapTypeOptTxt: { fontSize: 14 },
  mapTypeOptTxtActive: {},

  centerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#111419",
    borderWidth: 1,
    borderColor: "#1f242e",
    alignItems: "center",
    justifyContent: "center",
  },
  centerBtnTxt: { color: "#00b8d9", fontSize: 16 },

  // Bottom
  bottomSafe: { position: "absolute", bottom: 0, left: 0, right: 0 },
  bottom: {
    backgroundColor: "rgba(10,12,16,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#1f242e",
    padding: 16,
    gap: 10,
  },

  glassWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  hintBox: {
    backgroundColor: "rgba(0,245,160,0.06)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(0,245,160,0.2)",
  },
  hintTxt: {
    color: "#f57f00",
    fontFamily: "monospace",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  mainBtn: { borderRadius: 14, padding: 16, alignItems: "center" },
  mainBtnStart: {
    backgroundColor: "#f57f00",
    shadowColor: "#f57f00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  mainBtnStop: {
    backgroundColor: "rgba(255,77,109,0.08)",
    borderWidth: 1.5,
    borderColor: "#ff4d6d",
  },
  mainBtnTxt: {
    color: "#000",
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1,
  },

  zoneCount: {
    color: "#2a2f3a",
    fontFamily: "monospace",
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 1,
  },
});
