// src/screens/MapScreen.js
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, SafeAreaView,
} from "react-native";
import { WebView } from "react-native-webview";
import useTracking from "../hooks/useTracking";
import { useAuth } from "../hooks/useAuth";
import RunHUD from "../components/RunHUD";
import ClaimModal from "../components/ClaimModal";
import { listenToZones, claimZone, captureZone } from "../services/firebase";
import { pointInPolygon, polygonCentroid, formatDistance, formatDuration } from "../utils/geo";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

// ─── Leaflet HTML — dark theme, OpenStreetMap tiles, zero API key needed ─────
const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#0d1117; }

    /* Invert + darken OSM tiles to get a dark map look */
    .leaflet-tile {
      filter: brightness(0.42) saturate(0.55) hue-rotate(180deg) invert(1);
    }
    /* Satellite tiles — don't filter */
    .leaflet-tile.satellite { filter: none; }

    .leaflet-control-attribution,
    .leaflet-control-zoom { display:none !important; }

    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(0,245,160,0.7); }
      70%  { box-shadow: 0 0 0 10px rgba(0,245,160,0); }
      100% { box-shadow: 0 0 0 0 rgba(0,245,160,0); }
    }
    .player-dot {
      width:16px; height:16px; border-radius:50%;
      border:3px solid #0a0c10;
      animation: pulse 1.8s infinite;
    }
    .pin-badge {
      width:32px; height:32px; border-radius:50%;
      background:#0a0c10; border:2.5px solid #00f5a0;
      display:flex; align-items:center; justify-content:center;
      font-size:13px; font-weight:700; font-family:monospace;
      cursor:pointer;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
  }).setView([20, 0], 2);

  // Tile layers
  var standardLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19 }
  ).addTo(map);

  var satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 }
  );

  // State
  var playerMarker   = null;
  var pathPolyline   = null;
  var loopPolygon    = null;
  var zoneGroup      = L.layerGroup().addTo(map);
  var centeredOnce   = false;
  var isSatellite    = false;

  // ── Message handler ─────────────────────────────────────────────────────────
  function onMessage(e) {
    try {
      var msg = JSON.parse(e.data);
      switch(msg.type) {
        case 'UPDATE_LOCATION': updateLocation(msg); break;
        case 'UPDATE_PATH':     updatePath(msg);     break;
        case 'UPDATE_LOOP':     updateLoop(msg);     break;
        case 'UPDATE_ZONES':    updateZones(msg);    break;
        case 'CENTER_ON_ME':    centerOnMe(msg);     break;
        case 'SET_MAP_TYPE':    setMapType(msg.mapType); break;
        case 'RESET':           resetMap();          break;
      }
    } catch(err) {}
  }
  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);

  // ── Location ────────────────────────────────────────────────────────────────
  function updateLocation(msg) {
    var pos = [msg.lat, msg.lng];
    if (!playerMarker) {
      var el = document.createElement('div');
      el.className = 'player-dot';
      el.style.background = msg.color || '#00f5a0';
      playerMarker = L.marker(pos, {
        icon: L.divIcon({ className:'', html:el, iconSize:[16,16], iconAnchor:[8,8] }),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      playerMarker.setLatLng(pos);
    }
    if (!centeredOnce) {
      map.setView(pos, 17, { animate: true });
      centeredOnce = true;
    }
  }

  // ── Run path ────────────────────────────────────────────────────────────────
  function updatePath(msg) {
    var latlngs = msg.points.map(function(p){ return [p.latitude, p.longitude]; });
    var color   = msg.isLoop ? '#ffd166' : '#00f5a0';
    if (!pathPolyline) {
      pathPolyline = L.polyline(latlngs, { color:color, weight:3, opacity:0.9 }).addTo(map);
    } else {
      pathPolyline.setLatLngs(latlngs);
      pathPolyline.setStyle({ color:color });
    }
  }

  // ── Loop polygon ────────────────────────────────────────────────────────────
  function updateLoop(msg) {
    var latlngs = msg.points.map(function(p){ return [p.latitude, p.longitude]; });
    if (loopPolygon) map.removeLayer(loopPolygon);
    loopPolygon = L.polygon(latlngs, {
      color:'#ffd166', weight:2,
      fillColor:'#ffd166', fillOpacity:0.13,
    }).addTo(map);
  }

  // ── Zones ───────────────────────────────────────────────────────────────────
  function updateZones(msg) {
    zoneGroup.clearLayers();
    msg.zones.forEach(function(zone) {
      if (!zone.coordinates || zone.coordinates.length < 3) return;
      var latlngs = zone.coordinates.map(function(p){ return [p.latitude, p.longitude]; });
      var color   = zone.ownerColor || '#00f5a0';

      L.polygon(latlngs, {
        color:color, weight:2,
        fillColor:color, fillOpacity:0.1,
      }).addTo(zoneGroup).on('click', function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'ZONE_TAPPED', zone:zone }));
      });

      if (zone.centroid) {
        var initial = ((zone.ownerName || '?')[0]).toUpperCase();
        var el = document.createElement('div');
        el.className = 'pin-badge';
        el.style.borderColor = color;
        el.style.color = color;
        el.textContent = initial;

        L.marker([zone.centroid.latitude, zone.centroid.longitude], {
          icon: L.divIcon({ className:'', html:el, iconSize:[32,32], iconAnchor:[16,16] }),
        }).addTo(zoneGroup).on('click', function(){
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'ZONE_TAPPED', zone:zone }));
        });
      }
    });
  }

  // ── Center ──────────────────────────────────────────────────────────────────
  function centerOnMe(msg) {
    if (msg.lat && msg.lng) map.setView([msg.lat, msg.lng], 17, { animate:true });
  }

  // ── Map type ────────────────────────────────────────────────────────────────
  function setMapType(type) {
    if (type === 'satellite' && !isSatellite) {
      map.removeLayer(standardLayer);
      satelliteLayer.addTo(map);
      isSatellite = true;
    } else if (type !== 'satellite' && isSatellite) {
      map.removeLayer(satelliteLayer);
      standardLayer.addTo(map);
      isSatellite = false;
    }
  }

  // ── Reset after run ─────────────────────────────────────────────────────────
  function resetMap() {
    if (pathPolyline) { map.removeLayer(pathPolyline); pathPolyline = null; }
    if (loopPolygon)  { map.removeLayer(loopPolygon);  loopPolygon  = null; }
    centeredOnce = false;
  }

  // Signal ready to React Native
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'MAP_READY' }));
<\/script>
</body>
</html>
`;

export default function MapScreen() {
  const { profile } = useAuth();
  const {
    PHASE, phase, location, pathPoints, distance, steps,
    elapsed, accuracy, loopPoints,
    startTracking, stopTracking, resetTracking, finishClaiming,
  } = useTracking();

  const webViewRef = useRef(null);
  const [zones,        setZones]        = useState([]);
  const [mapType,      setMapType]      = useState("standard");
  const [showClaim,    setShowClaim]    = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [mapReady,     setMapReady]     = useState(false);
  const [showZones,    setShowZones]    = useState(false);

  // ── Send message to Leaflet ─────────────────────────────────────────────────
  const post = useCallback((msg) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  // ── Zones listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenToZones(setZones);
    return unsub;
  }, []);

  // ── Push zones to map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady) post({ type: "UPDATE_ZONES", zones: showZones ? zones : [] });
  }, [zones, mapReady, showZones]);

  // ── Push location ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (location && mapReady) {
      post({ type: "UPDATE_LOCATION", lat: location.latitude, lng: location.longitude, color: profile?.color || "#00f5a0" });
    }
  }, [location, mapReady]);

  // ── Push path ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pathPoints.length > 1 && mapReady) {
      post({ type: "UPDATE_PATH", points: pathPoints, isLoop: phase === PHASE.LOOP });
    }
  }, [pathPoints, mapReady]);

  // ── Push loop polygon + open claim modal ────────────────────────────────────
  useEffect(() => {
    if (loopPoints && mapReady) {
      post({ type: "UPDATE_LOOP", points: loopPoints });
      setShowClaim(true);
    }
  }, [loopPoints, mapReady]);

  // ── Map type ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady) post({ type: "SET_MAP_TYPE", mapType });
  }, [mapType, mapReady]);

  // ── Messages FROM WebView ───────────────────────────────────────────────────
  const handleWebViewMessage = useCallback((e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "MAP_READY")    setMapReady(true);
      if (msg.type === "ZONE_TAPPED")  setSelectedZone(msg.zone);
    } catch {}
  }, []);

  // ── Overlapping zone check ──────────────────────────────────────────────────
  const overlappingZone = useCallback(() => {
    if (!loopPoints) return null;
    const centroid = polygonCentroid(loopPoints);
    return zones.find(
      (z) => z.ownerId !== profile?.uid && z.coordinates && pointInPolygon(centroid, z.coordinates),
    ) || null;
  }, [loopPoints, zones, profile]);

  const handleStartStop = async () => {
    if (phase === PHASE.IDLE) {
      try { await startTracking(); }
      catch (e) { Alert.alert("Error", e.message); }
    } else if (phase === PHASE.RUNNING) {
      Alert.alert("Stop Run?", "Loop not closed yet. Your zone will not be saved.", [
        { text: "Keep Running", style: "cancel" },
        { text: "Stop", style: "destructive", onPress: stopTracking },
      ]);
    }
  };

  const handleClaimDone = async () => {
    try {
      const existing = overlappingZone();
      const payload  = buildZonePayload();
      if (!payload) return;

      if (!existing) {
        await claimZone(payload);
        Alert.alert("Zone claimed!", "You now own this Territory.");
      } else {
        const result = await captureZone(existing.id, {
          uid: profile.uid, username: profile.username, color: profile.color,
          distance, durationSeconds: elapsed,
        });
        if (result.success) Alert.alert("Zone Captured!", result.reason);
        else Alert.alert("Challenge Failed", result.reason);
      }
    } catch (err) { Alert.alert("Error", err.message); }

    setShowClaim(false);
    finishClaiming();
    post({ type: "RESET" });
    resetTracking();
  };

  const handleClaimDiscard = () => {
    setShowClaim(false);
    post({ type: "RESET" });
    resetTracking();
  };

  const centerOnMe = () => {
    if (!location) return;
    post({ type: "CENTER_ON_ME", lat: location.latitude, lng: location.longitude });
  };

  const buildZonePayload = () => {
    if (!loopPoints || !profile) return null;
    return {
      ownerId: profile.uid, ownerName: profile.username, ownerColor: profile.color,
      coordinates: loopPoints, centroid: polygonCentroid(loopPoints),
      distance, durationSeconds: elapsed,
    };
  };

  const isRunning = phase === PHASE.RUNNING;

  return (
    <View style={styles.container}>

      {/* ── LEAFLET MAP — free, no API key ── */}
      <WebView
        ref={webViewRef}
        style={StyleSheet.absoluteFillObject}
        source={{ html: LEAFLET_HTML }}
        onMessage={handleWebViewMessage}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />

      {/* ── ZONE DETAIL POPUP ── */}
      {selectedZone && (
        <View style={styles.zoneDetail}>
          <Text style={styles.zoneOwner}>⚑ {selectedZone.ownerName}</Text>
          <Text style={styles.zoneStat}>Distance Record: {formatDistance(selectedZone.distance)}</Text>
          <Text style={styles.zoneStat}>Time Record: {formatDuration(selectedZone.durationSeconds)}</Text>
          <Text style={styles.zoneChallenge}>To Capture: Run further OR faster</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedZone(null)}>
            <Text style={styles.closeBtnTxt}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TOP BAR ── */}
      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <BlurView intensity={40} tint="dark" style={styles.glassWrap}>
          <LinearGradient
            colors={["rgba(255,140,0,0.45)","rgba(255,94,0,0.25)","rgba(255,50,0,0.12)","transparent"]}
            start={{ x:0, y:1 }} end={{ x:1, y:0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <View style={[styles.logoDot, isRunning && styles.logoDotLive]} />
              <Text style={styles.logoTxt}>
                Zone<Text style={{ color:"#f57f00" }}>Wars</Text>
              </Text>
            </View>
            <View style={styles.topRight}>
              <TouchableOpacity
                style={[styles.zonesToggleBtn, showZones && styles.zonesToggleBtnActive]}
                onPress={() => {
                  setShowZones(v => !v);
                  if (selectedZone) setSelectedZone(null);
                }}
              >
                <Text style={[styles.zonesToggleTxt, showZones && styles.zonesToggleTxtActive]}>
                  ⚑ ZONES
                </Text>
              </TouchableOpacity>
              <View style={styles.mapTypePill}>
                {["standard","satellite"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.mapTypeOpt, mapType === t && styles.mapTypeOptActive]}
                    onPress={() => setMapType(t)}
                  >
                    <Text style={styles.mapTypeOptTxt}>{t === "standard" ? "🗺" : "🛰"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.centerBtn} onPress={centerOnMe}>
                <Text style={styles.centerBtnTxt}>◎</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </SafeAreaView>

      {/* ── BOTTOM PANEL ── */}
      <SafeAreaView style={styles.bottomSafe}>
        <BlurView intensity={40} tint="dark" style={styles.glassWrap}>
          <LinearGradient
            colors={["rgba(255,140,0,0.45)","rgba(255,94,0,0.25)","rgba(255,50,0,0.12)","transparent"]}
            start={{ x:0, y:1 }} end={{ x:1, y:0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.bottom}>
            {isRunning && (
              <View style={styles.hintBox}>
                <Text style={styles.hintTxt}>
                  🏃 Run a loop and return within 20m of your start to claim a zone
                </Text>
              </View>
            )}
            <RunHUD distance={distance} elapsed={elapsed} steps={steps} accuracy={accuracy} phase={phase} />
            <TouchableOpacity
              style={[styles.mainBtn, isRunning ? styles.mainBtnStop : styles.mainBtnStart]}
              onPress={handleStartStop} activeOpacity={0.85}
            >
              <Text style={[styles.mainBtnTxt, isRunning && { color:"#ff4d6d" }]}>
                {isRunning ? "■  STOP RUN" : "▶  START RUN"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.zoneCount}>
              {zones.length} zone{zones.length !== 1 ? "s" : ""} claimed worldwide · {showZones ? "tap ⚑ ZONES to hide" : "tap ⚑ ZONES to explore"}
            </Text>
          </View>
        </BlurView>
      </SafeAreaView>

      {/* ── CLAIM MODAL ── */}
      <ClaimModal
        visible={showClaim} polygon={loopPoints} distance={distance}
        elapsed={elapsed} steps={steps} profile={profile}
        overlappingZone={overlappingZone()}
        onDone={handleClaimDone} onDiscard={handleClaimDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:"#0a0c10" },

  zoneDetail:    { position:"absolute", bottom:180, left:20, right:20, backgroundColor:"rgba(10,12,16,0.97)", padding:16, borderRadius:16, borderWidth:1, borderColor:"#2a2f3a", zIndex:10 },
  zoneOwner:     { color:"#f57f00", fontFamily:"monospace", fontSize:16, fontWeight:"bold", marginBottom:8 },
  zoneStat:      { color:"#e8eaf0", fontFamily:"monospace", fontSize:13, marginBottom:4 },
  zoneChallenge: { color:"#00f5a0", fontFamily:"monospace", fontSize:11, marginTop:8, letterSpacing:0.3 },
  closeBtn:      { marginTop:12, alignSelf:"flex-end" },
  closeBtnTxt:   { color:"#5a6070", fontFamily:"monospace", fontSize:12 },

  topSafe:     { position:"absolute", top:15, left:0, right:0 },
  topBar:      { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:10 },
  logoRow:     { flexDirection:"row", alignItems:"center", gap:8 },
  logoDot:     { width:10, height:10, borderRadius:5, backgroundColor:"#5a6070" },
  logoDotLive: { backgroundColor:"#f57f00" },
  logoTxt:     { color:"#e8eaf0", fontFamily:"monospace", fontSize:18, fontWeight:"900" },
  topRight:    { flexDirection:"row", gap:8, alignItems:"center" },

  mapTypePill:      { flexDirection:"row", backgroundColor:"#111419", borderRadius:10, borderWidth:1, borderColor:"#1f242e", overflow:"hidden" },
  mapTypeOpt:       { paddingHorizontal:10, paddingVertical:6 },
  mapTypeOptActive: { backgroundColor:"#1f242e" },
  mapTypeOptTxt:    { fontSize:14 },

  centerBtn:    { width:36, height:36, borderRadius:10, backgroundColor:"#111419", borderWidth:1, borderColor:"#1f242e", alignItems:"center", justifyContent:"center" },
  centerBtnTxt: { color:"#00b8d9", fontSize:16 },

  zonesToggleBtn:       { paddingHorizontal:10, paddingVertical:7, borderRadius:10, backgroundColor:"#111419", borderWidth:1, borderColor:"#1f242e", alignItems:"center", justifyContent:"center" },
  zonesToggleBtnActive: { backgroundColor:"rgba(0,245,160,0.12)", borderColor:"rgba(0,245,160,0.5)" },
  zonesToggleTxt:       { color:"#5a6070", fontFamily:"monospace", fontSize:9, fontWeight:"700", letterSpacing:1 },
  zonesToggleTxtActive: { color:"#00f5a0" },

  glassWrap: { overflow:"hidden", borderWidth:1, borderColor:"rgba(255,255,255,0.08)", backgroundColor:"rgba(255,255,255,0.05)" },

  bottomSafe: { position:"absolute", bottom:0, left:0, right:0 },
  bottom:     { backgroundColor:"rgba(10,12,16,0.96)", borderTopWidth:1, borderTopColor:"#1f242e", padding:16, gap:10 },

  hintBox: { backgroundColor:"rgba(0,245,160,0.06)", borderRadius:10, padding:10, borderWidth:1, borderColor:"rgba(0,245,160,0.2)" },
  hintTxt: { color:"#f57f00", fontFamily:"monospace", fontSize:10, textAlign:"center", letterSpacing:0.3 },

  mainBtn:      { borderRadius:14, padding:16, alignItems:"center" },
  mainBtnStart: { backgroundColor:"#f57f00", shadowColor:"#f57f00", shadowOffset:{ width:0, height:4 }, shadowOpacity:0.35, shadowRadius:12, elevation:8 },
  mainBtnStop:  { backgroundColor:"rgba(255,77,109,0.08)", borderWidth:1.5, borderColor:"#ff4d6d" },
  mainBtnTxt:   { color:"#000", fontFamily:"monospace", fontWeight:"900", fontSize:14, letterSpacing:1 },

  zoneCount: { color:"#2a2f3a", fontFamily:"monospace", fontSize:9, textAlign:"center", letterSpacing:1 },
});
