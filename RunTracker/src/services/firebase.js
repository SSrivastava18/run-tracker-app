// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAibdAvzWJyzfkZee4-re_Kl_q3RyX3z5c',
  authDomain:        'zonewars-40dde.firebaseapp.com',
  projectId:         'zonewars-40dde',
  storageBucket:     'zonewars-40dde.firebasestorage.app',
  messagingSenderId: '732455723038',
  appId:             '1:732455723038:web:c0deb442ff1f7bd93a0e0f',
  measurementId:     'G-QVN26QYVKE',
};
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Prevent "duplicate-app" error on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ✅ Auth with AsyncStorage persistence (fixes the warning)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  // initializeAuth already called — just get the existing instance
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

const db = getFirestore(app);

// ── AUTH ──────────────────────────────────────────────────────────────────────

export const registerUser = async (email, password, username) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  await setDoc(doc(db, 'players', cred.user.uid), {
    uid:           cred.user.uid,
    username,
    email,
    totalDistance: 0,
    totalTime:     0,
    totalSteps:    0,
    zonesOwned:    0,
    createdAt:     serverTimestamp(),
  });
  return cred.user;
};

export const loginUser    = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser   = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);
export const currentUser  = () => auth.currentUser;

// ── PLAYER ────────────────────────────────────────────────────────────────────

export const getPlayer = async (uid) => {
  const snap = await getDoc(doc(db, 'players', uid));
  return snap.exists() ? snap.data() : null;
};

export const updatePlayerStats = async (uid, stats) => {
  await updateDoc(doc(db, 'players', uid), stats);
};

// ── ZONES ─────────────────────────────────────────────────────────────────────

export const claimZone = async (zone) => {
  const zoneRef = doc(collection(db, 'zones'));
  await setDoc(zoneRef, {
    ...zone,
    zoneId:    zoneRef.id,
    claimedAt: serverTimestamp(),
    history:   [],
  });
  return zoneRef.id;
};

export const captureZone = async (zoneId, challenger) => {
  const zoneRef  = doc(db, 'zones', zoneId);
  const zoneSnap = await getDoc(zoneRef);
  if (!zoneSnap.exists()) return { success: false, reason: 'Zone not found' };

  const zone = zoneSnap.data();

  if (zone.ownerId === challenger.uid) {
    return { success: false, reason: 'You already own this zone' };
  }

  const fasterTime   = challenger.durationSeconds < zone.durationSeconds;
  const moreDistance = challenger.distance > zone.distance;

  if (!fasterTime && !moreDistance) {
    return {
      success: false,
      reason: `Beat the owner's time (${formatDuration(zone.durationSeconds)}) or distance (${zone.distance.toFixed(0)}m)`,
    };
  }

  await updateDoc(zoneRef, {
    ownerId:         challenger.uid,
    ownerName:       challenger.username,
    ownerColor:      challenger.color,
    distance:        challenger.distance,
    durationSeconds: challenger.durationSeconds,
    claimedAt:       serverTimestamp(),
    history: [
      ...(zone.history || []),
      { uid: zone.ownerId, name: zone.ownerName, lostAt: new Date().toISOString() },
    ],
  });

  return { success: true, reason: fasterTime ? 'Faster time!' : 'More distance!' };
};

export const listenToZones = (cb) => {
  return onSnapshot(collection(db, 'zones'), (snap) => {
    const zones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(zones);
  });
};

export const listenToLeaderboard = (cb) => {
  const q = query(collection(db, 'players'), orderBy('zonesOwned', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data()));
  });
};

// ── UTILS ─────────────────────────────────────────────────────────────────────

export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const COLORS = ['#00f5a0','#ff6b6b','#ffd166','#06d6a0','#118ab2','#ef476f','#a8dadc','#f4a261'];
export const playerColor = (uid) => COLORS[uid.charCodeAt(0) % COLORS.length];
