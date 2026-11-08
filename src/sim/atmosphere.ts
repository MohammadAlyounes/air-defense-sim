/**
 * The air the aircraft and interceptors fly through.
 *
 * Step 4 uses the International Standard Atmosphere (ISA): the temperature falls by 6.5 °C per
 * kilometre up to 11 km, stays at −56.5 °C up to 20 km, then warms slowly. The pressure follows
 * from the weight of the air above (hydrostatic balance), and the density from the ideal gas
 * law, ρ = p / (R·T). The simpler exponential atmosphere is kept for comparison and tests.
 *
 * Heights are metres above the battery's ground, which is the datum ("sea level" in the UI).
 */
export interface Atmosphere {
  /** Air density at `heightM` above the ground datum, kg/m³. */
  densityKgM3(heightM: number): number;
}

/** Sea-level density of the standard atmosphere, kg/m³. */
export const SEA_LEVEL_DENSITY_KGM3 = 1.225;
/** Height over which the exponential atmosphere's density falls by a factor e (≈ 2.718), m. */
export const SCALE_HEIGHT_M = 8_500;

/** ρ(h) = ρ₀ · e^(−h / H): the simplest textbook model, halving about every 5.9 km. */
export const EXPONENTIAL_ATMOSPHERE: Atmosphere = {
  densityKgM3: (heightM) =>
    SEA_LEVEL_DENSITY_KGM3 * Math.exp(-Math.max(0, heightM) / SCALE_HEIGHT_M),
};

/** Specific gas constant of dry air, J/(kg·K). */
export const GAS_CONSTANT_AIR = 287.053;
/** Standard gravity used by the ISA, m/s². */
const G0 = 9.80665;
/** Ratio of specific heats of air (for the speed of sound). */
const GAMMA_AIR = 1.4;

/** One layer of the standard atmosphere: a constant temperature gradient from its base. */
interface Layer {
  baseM: number;
  baseTemperatureK: number;
  /** Temperature change with height, K/m (negative: colder higher up). */
  lapseKPerM: number;
  basePressurePa: number;
}

/** Temperature at height `h` inside `layer`, K. */
const layerTemperature = (layer: Layer, h: number) =>
  layer.baseTemperatureK + layer.lapseKPerM * (h - layer.baseM);

/** Pressure at height `h` inside `layer`, from hydrostatic balance and the ideal gas law, Pa. */
function layerPressure(layer: Layer, h: number): number {
  if (layer.lapseKPerM === 0) {
    return (
      layer.basePressurePa *
      Math.exp((-G0 * (h - layer.baseM)) / (GAS_CONSTANT_AIR * layer.baseTemperatureK))
    );
  }
  return (
    layer.basePressurePa *
    Math.pow(
      layerTemperature(layer, h) / layer.baseTemperatureK,
      -G0 / (layer.lapseKPerM * GAS_CONSTANT_AIR),
    )
  );
}

/** The ISA's first three layers, each starting where the one below ends. */
const ISA_LAYERS: readonly Layer[] = (() => {
  const layers: Layer[] = [];
  const spec = [
    { baseM: 0, lapseKPerM: -0.0065 }, // troposphere
    { baseM: 11_000, lapseKPerM: 0 }, // tropopause and lower stratosphere
    { baseM: 20_000, lapseKPerM: 0.001 }, // stratosphere
  ];
  let base: Layer = {
    baseM: 0,
    baseTemperatureK: 288.15,
    lapseKPerM: -0.0065,
    basePressurePa: 101_325,
  };
  for (const s of spec) {
    if (layers.length > 0) {
      base = {
        baseM: s.baseM,
        baseTemperatureK: layerTemperature(base, s.baseM),
        lapseKPerM: s.lapseKPerM,
        basePressurePa: layerPressure(base, s.baseM),
      };
    }
    layers.push(base);
  }
  return layers;
})();

/** The ISA is defined up to 32 km here; higher up the values of 32 km are used. */
const ISA_TOP_M = 32_000;

/** The state of the standard atmosphere at one height. */
export interface AirState {
  temperatureK: number;
  pressurePa: number;
  densityKgM3: number;
  speedOfSoundMps: number;
}

/** International Standard Atmosphere at `heightM` (clamped to 32 km at the top). */
export function standardAtmosphere(heightM: number): AirState {
  const h = Math.min(heightM, ISA_TOP_M);
  let layer = ISA_LAYERS[0] as Layer;
  for (const candidate of ISA_LAYERS) if (h >= candidate.baseM) layer = candidate;
  const temperatureK = layerTemperature(layer, h);
  const pressurePa = layerPressure(layer, h);
  return {
    temperatureK,
    pressurePa,
    densityKgM3: pressurePa / (GAS_CONSTANT_AIR * temperatureK),
    speedOfSoundMps: Math.sqrt(GAMMA_AIR * GAS_CONSTANT_AIR * temperatureK),
  };
}

/** The standard atmosphere behind the `Atmosphere` interface: the default for every model. */
export const STANDARD_ATMOSPHERE: Atmosphere = {
  densityKgM3: (heightM) => standardAtmosphere(heightM).densityKgM3,
};
