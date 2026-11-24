import {CAMERAS, DESIGN_OBJECTS, DESIGN_ZONES, ENTRY_KEYS, INTERIOR} from './layout-reference.mjs';

export {CAMERAS, DESIGN_OBJECTS, DESIGN_ZONES, ENTRY_KEYS, INTERIOR};
export const toWorld = ([east, north, height = 0]) => [east, height, -north];
export const EYE_HEIGHT = 1.61;
export const FITTING_MARK = toWorld([-4, 16.95, 0]);

function cameraPose({position, target, focalLengthMm, sensorWidthMm, shiftY}) {
  const [x, y, z] = toWorld(position);
  const [targetX, targetY, targetZ] = toWorld(target);
  const dx = targetX - x;
  const dz = targetZ - z;
  return {
    x, y, z,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(targetY - y, Math.hypot(dx, dz)),
    focalLengthMm, sensorWidthMm, shiftY,
  };
}

const entryPoses = ENTRY_KEYS.map(key => ({
  ...cameraPose(CAMERAS[key.cameraId]),
  progress: key.progress,
  door: Number(key.doorState === 'open'),
}));

export function introPose(progress) {
  const t = Math.max(0, Math.min(1, progress));
  const nextIndex = entryPoses.findIndex((pose, index) => index > 0 && pose.progress >= t);
  const a = entryPoses[nextIndex - 1];
  const b = entryPoses[nextIndex];
  const p = (t - a.progress) / (b.progress - a.progress);
  const lerp = key => p === 1 ? b[key] : a[key] + (b[key] - a[key]) * p;
  const opening = Math.max(0, Math.min(1, (t - 0.10) / 0.22));
  return {
    x: lerp('x'), y: lerp('y'), z: lerp('z'),
    yaw: lerp('yaw'), pitch: lerp('pitch'),
    focalLengthMm: lerp('focalLengthMm'), sensorWidthMm: lerp('sensorWidthMm'),
    shiftY: lerp('shiftY'), door: opening * opening * (3 - 2 * opening),
  };
}

export function applyCameraLens(camera, {focalLengthMm, sensorWidthMm, shiftY = 0}) {
  // Portrait widens the vertical field slightly instead of cropping to a narrow slit.
  const portraitBlend = Math.max(0,Math.min(1,(camera.aspect-.45)/1.05));
  const filmAspect = Math.max(camera.aspect,1.12+.38*portraitBlend);
  camera.fov = 2 * Math.atan(sensorWidthMm / (2 * filmAspect * focalLengthMm)) * 180 / Math.PI;
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] += 2 * shiftY * filmAspect;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

const tourStart = introPose(1);
const tourStops = [
  [tourStart.x,tourStart.z,tourStart.yaw],
  [2.46,-7.9,-.19],
  [2.75,-9.62,-.74],
  [2.74,-11.78,.78],
  [0,-12.17,0],
];
const tourDistances = [0];
for (let index = 1; index < tourStops.length; index++) {
  const [x,z] = tourStops[index], [previousX,previousZ] = tourStops[index-1];
  tourDistances.push(tourDistances[index-1]+Math.hypot(x-previousX,z-previousZ));
}

export function tourPose(progress) {
  const distance = Math.max(0,Math.min(1,progress))*tourDistances.at(-1);
  const index = tourDistances.findIndex((mark,i) => i>0 && distance<=mark);
  const [x,z,yaw] = tourStops[index-1];
  const [nextX,nextZ,nextYaw] = tourStops[index];
  const fraction = (distance-tourDistances[index-1])/(tourDistances[index]-tourDistances[index-1]);
  const look = fraction*fraction*(3-2*fraction);
  return {
    ...tourStart,
    x: x+(nextX-x)*fraction,
    z: z+(nextZ-z)*fraction,
    yaw: yaw+(nextYaw-yaw)*look,
  };
}

export const SPACE_ENTRIES = {
  fitting:toWorld([-4,12.84,2.54]),
  concierge:toWorld([0,12.84,2.54]),
  ootd:toWorld([4,12.84,2.54]),
  fragrance:toWorld([4.63,9.9,1.35]),
};

export const ZONES = {
  showroom: {name:'MAIN SHOWROOM', label:'쇼룸', position:toWorld([2.25,4.68,EYE_HEIGHT]), yaw:introPose(1).yaw},
  fitting: {name:'FITTING ROOM', label:'피팅룸', position:toWorld([-4,14.25,EYE_HEIGHT]), yaw:0},
  fragrance: {name:'FRAGRANCE BAR', label:'향수 바', position:toWorld([3.1,9.5,EYE_HEIGHT]), yaw:-Math.PI/2},
  concierge: {name:'STYLE CONCIERGE', label:'스타일 상담', position:toWorld([0,13.9,EYE_HEIGHT]), yaw:0},
  ootd: {name:'OOTD STUDIO', label:'코디·기록', position:toWorld([4,14.0,EYE_HEIGHT]), yaw:0},
};

const footprint = id => {
  const {center:[x,north], size:[width,depth]} = DESIGN_OBJECTS.find(object => object.id === id);
  return [x-width/2,x+width/2,-north-depth/2,-north+depth/2];
};

const [west, east, south, north] = [-6, 6, 0, -19];
const portalWall = [-6,-4.7,-3.3,-.7,.7,3.3,4.7,6];
export const OBSTACLES = [
  ...[0,2,4,6].map(i => [portalWall[i],portalWall[i+1],-13.13,-12.87]),
  [-2.075,-1.925,-19,-13], [1.925,2.075,-19,-13],
  ...[2.62,6.28,9.94].map(n => [-5.9,-5.16,-n-1.655,-n+1.655]),
  [5.34,5.94,-6.945,-2.275], [5.34,5.94,-11.98,-8.46],
  footprint('limestone_plinth'), footprint('fragrance_counter'),
  [-5.8,-5.24,-17.61,-15.67], [-1.075,1.075,-16.66,-15.42],
  [-1.28,-.56,-15.43,-14.71], [.56,1.28,-15.43,-14.71],
  [-.36,.36,-17.34,-16.62],
  [3.58,4.42,-15.34,-14.50],
  [2.31,3.15,-17.86,-17.02], [4.85,5.69,-17.86,-17.02],
];
const island = DESIGN_OBJECTS.find(object => object.id === 'oval_island');
const PLAYER_RADIUS = .22;

export function canStand(x, z, obstacles = OBSTACLES, doorOpen = true) {
  const r = PLAYER_RADIUS;
  if (x <= west+r || x >= east-r || z <= north+r || z >= south-r) return false;
  if (!doorOpen && z > -.52 && Math.abs(x) < 1.44+r) return false;
  const [islandX, islandNorth] = island.center;
  const [width, depth] = island.size;
  if (((x-islandX)/(width/2+r))**2 + ((z+islandNorth)/(depth/2+r))**2 < 1) return false;
  return !obstacles.some(([a,b,c,d]) => x>a-r && x<b+r && z>c-r && z<d+r);
}

export function walk(position, dx, dz, obstacles = OBSTACLES, doorOpen = true) {
  const next = {...position};
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
  for (let i = 0; i < steps; i++) {
    if (canStand(next.x+dx/steps,next.z,obstacles,doorOpen)) next.x += dx/steps;
    if (canStand(next.x,next.z+dz/steps,obstacles,doorOpen)) next.z += dz/steps;
  }
  return next;
}
