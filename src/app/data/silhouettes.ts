/**
 * Top-down aircraft silhouettes in a 32 × 32 box, nose pointing up (north). Generic shapes,
 * not real airframes. Used by the palette icons and extruded into the 3D models, so both
 * views draw the same aircraft.
 */
export const SILHOUETTES = {
  cruise:
    'M16 1.5C17 2.6 17.5 4 17.5 5.5L17.5 14.5L23.5 18.5L23.5 20L17.5 18L17.5 25L20.5 28L20.5 29.5L16 28.5L11.5 29.5L11.5 28L14.5 25L14.5 18L8.5 20L8.5 18.5L14.5 14.5L14.5 5.5C14.5 4 15 2.6 16 1.5Z',
  jet: 'M16 1.5C16.9 2.8 17.3 4.3 17.4 6L17.8 12.5L28 22L28 23.6L18.2 21.5L18.2 25L22 28.5L22 30L17.4 29L16 29.8L14.6 29L10 30L10 28.5L13.8 25L13.8 21.5L4 23.6L4 22L14.2 12.5L14.6 6C14.7 4.3 15.1 2.8 16 1.5Z',
  friendly:
    'M16 2.5C16.9 3.3 17.4 4.3 17.4 5.5L17.4 11L29.5 13.5L29.5 16L17.4 15.5L17 24L21.5 25.5L21.5 27.5L16 27L10.5 27.5L10.5 25.5L15 24L14.6 15.5L2.5 16L2.5 13.5L14.6 11L14.6 5.5C14.6 4.3 15.1 3.3 16 2.5Z',
  airliner:
    'M16 1.5C17.3 1.5 17.8 3 17.8 5L17.8 11.5L29.5 18L29.5 19.8L17.8 16.8L17.6 25L22 28.3L22 29.8L16 28.8L10 29.8L10 28.3L14.4 25L14.2 16.8L2.5 19.8L2.5 18L14.2 11.5L14.2 5C14.2 3 14.7 1.5 16 1.5Z',
} as const;

export type SilhouetteId = keyof typeof SILHOUETTES;

/** Airliner engine pods: [x, y, width, height] in the same 32 × 32 box. */
export const AIRLINER_ENGINES: readonly (readonly [number, number, number, number])[] = [
  [21.4, 12.6, 1.8, 3.6],
  [8.8, 12.6, 1.8, 3.6],
];
