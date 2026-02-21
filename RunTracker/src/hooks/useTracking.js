// src/hooks/useTracking.js
import { useState, useRef, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import {
  totalDistance,
  distanceToSteps,
  isLoopClosed,
  formatDistance,
} from '../utils/geo';

const PHASE = {
  IDLE:      'IDLE',       // not running
  RUNNING:   'RUNNING',    // actively tracking
  LOOP:      'LOOP',       // loop closed — confirm claim
  CLAIMING:  'CLAIMING',   // uploading to Firebase
};

export default function useTracking() {
  const [phase,        setPhase]        = useState(PHASE.IDLE);
  const [location,     setLocation]     = useState(null);
  const [pathPoints,   setPathPoints]   = useState([]);   // [{latitude, longitude}]
  const [distance,     setDistance]     = useState(0);    // metres
  const [steps,        setSteps]        = useState(0);
  const [elapsed,      setElapsed]      = useState(0);    // seconds
  const [loopPoints,   setLoopPoints]   = useState(null); // polygon coords when closed
  const [accuracy,     setAccuracy]     = useState(null);

  const watchRef      = useRef(null);
  const timerRef      = useRef(null);
  const accelSub      = useRef(null);
  const stepBuf       = useRef({ lastMag: 0, stepCount: 0, lastStep: 0 });
  const startTime     = useRef(null);

  // ── Step counting via accelerometer ────────────────────────────────────────
  const startAccel = () => {
    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
      const mag  = Math.sqrt(x * x + y * y + z * z);
      const buf  = stepBuf.current;
      const now  = Date.now();
      // Peak detection — simple threshold crossing
      if (mag > 1.2 && buf.lastMag <= 1.2 && now - buf.lastStep > 300) {
        buf.stepCount++;
        buf.lastStep = now;
        setSteps(buf.stepCount);
      }
      buf.lastMag = mag;
    });
  };

  const stopAccel = () => {
    accelSub.current?.remove();
    accelSub.current = null;
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = () => {
    startTime.current = Date.now();
    timerRef.current  = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // ── GPS watch ──────────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    // Reset state
    setPathPoints([]);
    setDistance(0);
    setSteps(0);
    setElapsed(0);
    setLoopPoints(null);
    stepBuf.current = { lastMag: 0, stepCount: 0, lastStep: 0 };

    setPhase(PHASE.RUNNING);
    startTimer();
    startAccel();

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy:         Location.Accuracy.BestForNavigation,
        timeInterval:     1000,
        distanceInterval: 3,
      },
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        const pt = { latitude, longitude };

        setLocation(pt);
        setAccuracy(acc);

        setPathPoints((prev) => {
          const next = [...prev, pt];

          // Update distance
          if (prev.length > 0) {
            const d = totalDistance(next);
            setDistance(d);
            // Sync steps with distance if accel underestimates
            setSteps((s) => Math.max(s, distanceToSteps(d)));
          }

          // Check loop closure (min 10 pts, within 20 m of start)
          if (isLoopClosed(next, 20, 10)) {
            setLoopPoints([...next]);
            setPhase(PHASE.LOOP);
            stopGPS();
            stopTimer();
            stopAccel();
          }

          return next;
        });
      }
    );
  }, []);

  const stopGPS = () => {
    watchRef.current?.remove();
    watchRef.current = null;
  };

  const stopTracking = useCallback(() => {
    stopGPS();
    stopTimer();
    stopAccel();
    setPhase(PHASE.IDLE);
  }, []);

  const resetTracking = useCallback(() => {
    stopTracking();
    setPathPoints([]);
    setDistance(0);
    setSteps(0);
    setElapsed(0);
    setLoopPoints(null);
    setLocation(null);
  }, [stopTracking]);

  const beginClaiming = () => setPhase(PHASE.CLAIMING);
  const finishClaiming = () => setPhase(PHASE.IDLE);

  // Cleanup on unmount
  useEffect(() => () => { stopGPS(); stopTimer(); stopAccel(); }, []);

  return {
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
  };
}
