### Local coordinates — one map for the radar, the scope and the 3D view

Every position is measured in metres from the battery: east (x), north (y) and up (z). The radar measures a bearing and a range, which the simulator turns into these flat local coordinates, accurate enough over a 40 km area. The 3D view draws the very same numbers, only turned so that "up" points up on your screen.

- **Formula:** `east = range × sin(bearing)`, `north = range × cos(bearing)`
- **Example:** an echo at bearing 090° and 20 km sits at east = 20 km, north = 0.
- **See it:** click an echo on the radar scope: the 3D view highlights the same aircraft, in the same place.

<!-- more -->

## Going deeper

**Why a flat local map is good enough.** Over 40 km the Earth's surface drops below a flat plane by `d² / (2R) = (40 km)² / (2 × 6371 km) ≈ 126 m`. That is small for plotting positions, but large for what a radar can see, so Step 4 adds Earth curvature to the line of sight while keeping the flat map for positions.

**Compass bearings versus maths angles.** Bearings start at north and turn clockwise; the angles in maths textbooks start at east and turn anticlockwise. That swap is why east uses `sin` and north uses `cos`.

**From the simulation to three.js.** three.js uses y for "up", and its default camera looks along −z. The 3D view therefore maps east → x, up → y and north → −z, in kilometres: `scene = (east, up × stretch, −north) / 1000`. The radar scope uses the same east and north, drawn with north up.
