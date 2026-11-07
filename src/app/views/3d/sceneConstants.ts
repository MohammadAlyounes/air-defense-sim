/** Fixed geometry of the 3D scene, in scene units (km). */

/** Search radar range: the outer ring (matches the simulation's 40 km). */
export const RADAR_RANGE_KM = 40;
/** Range rings every 10 km, like the radar scope. */
export const RING_STEP_KM = 10;
/** Ring distance labels sit along this compass bearing (south-south-west: near the default camera). */
export const RING_LABEL_BEARING_RAD = (200 * Math.PI) / 180;
/** N, E, S and W letters sit just outside the outer ring. */
export const COMPASS_RADIUS_KM = RADAR_RANGE_KM + 3;
/** Hostiles whose course passes inside this ring are threats (the command node's threat radius). */
export const DEFENDED_RADIUS_KM = 5;
/** Its label sits along this bearing (south-south-east), just outside the ring. */
export const DEFENDED_LABEL_BEARING_RAD = (155 * Math.PI) / 180;
