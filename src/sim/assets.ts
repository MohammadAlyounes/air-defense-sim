import { vec3, type Vec3 } from './core/vec';

/**
 * What the battery protects. Fictional places with generic names (see SAFETY.md). A hostile
 * whose course passes inside an asset's threat radius is a threat to it; one that gets inside
 * its leak radius has got through.
 */
export interface DefendedAsset {
  id: number;
  name: string;
  /** Ground position, m (east, north; z unused). */
  position: Vec3;
  /** Courses passing this close are threats to it, m. */
  threatRadiusM: number;
  /** A hostile this close has reached it: the defense failed, m. */
  leakRadiusM: number;
}

/** The battery itself is asset 0: it defends itself as well as the places around it. */
export const DEFAULT_ASSETS: readonly DefendedAsset[] = [
  { id: 0, name: 'Battery', position: vec3(0, 0, 0), threatRadiusM: 5_000, leakRadiusM: 2_000 },
  {
    id: 1,
    name: 'Town',
    position: vec3(-6_500, 4_000, 0),
    threatRadiusM: 2_500,
    leakRadiusM: 1_500,
  },
  {
    id: 2,
    name: 'Power plant',
    position: vec3(5_000, -4_500, 0),
    threatRadiusM: 1_500,
    leakRadiusM: 800,
  },
];

/** The asset closest to a ground point. */
export function nearestAsset(
  eastM: number,
  northM: number,
  assets: readonly DefendedAsset[] = DEFAULT_ASSETS,
): DefendedAsset {
  let best = assets[0] ?? DEFAULT_ASSETS[0];
  let bestD = Infinity;
  for (const asset of assets) {
    const d = Math.hypot(asset.position.x - eastM, asset.position.y - northM);
    if (d < bestD) {
      bestD = d;
      best = asset;
    }
  }
  if (!best) throw new Error('no defended assets');
  return best;
}
