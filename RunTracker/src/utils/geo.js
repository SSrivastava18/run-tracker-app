// src/utils/geo.js

/**
 * Haversine distance between two {latitude, longitude} points in metres
 */
export function haversineDistance(a, b) {
  const R   = 6371000;
  const φ1  = (a.latitude  * Math.PI) / 180;
  const φ2  = (b.latitude  * Math.PI) / 180;
  const Δφ  = ((b.latitude  - a.latitude)  * Math.PI) / 180;
  const Δλ  = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x   = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Total path distance in metres
 */
export function totalDistance(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineDistance(points[i - 1], points[i]);
  return d;
}

/**
 * Estimate steps from distance (avg stride ~0.76 m)
 */
export const distanceToSteps = (metres) => Math.round(metres / 0.76);

/**
 * Check if the runner has closed the loop:
 * returns true if current point is within `thresholdM` metres of the first point
 * and at least `minPoints` have been recorded.
 */
export function isLoopClosed(points, thresholdM = 20, minPoints = 10) {
  if (points.length < minPoints) return false;
  return haversineDistance(points[0], points[points.length - 1]) <= thresholdM;
}

/**
 * Point-in-polygon test (ray casting algorithm)
 * polygon: array of {latitude, longitude}
 * point:   {latitude, longitude}
 */
export function pointInPolygon(point, polygon) {
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude;
    const xj = polygon[j].longitude, yj = polygon[j].latitude;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute centroid of a polygon
 */
export function polygonCentroid(points) {
  const lat = points.reduce((s, p) => s + p.latitude,  0) / points.length;
  const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  return { latitude: lat, longitude: lng };
}

/**
 * Approximate polygon area in m² (Shoelace formula on flat Earth approx)
 */
export function polygonArea(points) {
  if (points.length < 3) return 0;
  const R     = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  let area    = 0;
  for (let i = 0; i < points.length; i++) {
    const j  = (i + 1) % points.length;
    const xi = toRad(points[i].longitude) * Math.cos(toRad(points[i].latitude)) * R;
    const yi = toRad(points[i].latitude)  * R;
    const xj = toRad(points[j].longitude) * Math.cos(toRad(points[j].latitude)) * R;
    const yj = toRad(points[j].latitude)  * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

/**
 * Format seconds to MM:SS or H:MM:SS for runs over an hour
 */
export function formatDuration(s) {
  const totalSecs = Math.floor(s);
  const h         = Math.floor(totalSecs / 3600);
  const m         = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const sec       = (totalSecs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

/**
 * Format metres nicely
 */
export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
