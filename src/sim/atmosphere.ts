/**
 * Air density with height: an exponential atmosphere, the simplest textbook model. Density
 * halves about every 5.9 km. It sits behind a small interface, so a fuller standard
 * atmosphere can replace it later.
 */
export interface Atmosphere {
  /** Air density at `heightM` above the ground datum, kg/m³. */
  densityKgM3(heightM: number): number;
}

/** Sea-level density of the standard atmosphere, kg/m³. */
export const SEA_LEVEL_DENSITY_KGM3 = 1.225;
/** Height over which density falls by a factor e (≈ 2.718), m. */
export const SCALE_HEIGHT_M = 8_500;

/** ρ(h) = ρ₀ · e^(−h / H). */
export const EXPONENTIAL_ATMOSPHERE: Atmosphere = {
  densityKgM3: (heightM) =>
    SEA_LEVEL_DENSITY_KGM3 * Math.exp(-Math.max(0, heightM) / SCALE_HEIGHT_M),
};
