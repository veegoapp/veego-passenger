/**
 * VehicleIcon
 *
 * Shared vehicle visual used by both the ride card (DriverAssignedCard) and
 * the live map marker (DriverMarker).
 *
 * CAR uses real photographed/rendered PNG assets (assets/images/vehicles/car/),
 * one per VeeGo catalog color, selected by nearest-color match against
 * colorHex — see CAR_COLOR_CATALOG / nearestCarColorKey below. Every other
 * type (scooter/delivery/hiace/minibus) still uses the existing hand-drawn
 * react-native-svg silhouettes: the body is the only part driven by color;
 * wheels/windows/details use a neutral tone chosen for contrast against that
 * body color (see resolveDetailColors), not a fixed value, so a black/navy
 * vehicle doesn't collapse into a solid blob.
 *
 * Two independent data axes feed this, kept separate rather than merged:
 *  - ride-level service type: car / scooter / delivery (rides.vehicleType)
 *  - shuttle trip vehicle type: hiace (14-seat microbus) / minibus (28-seat)
 *    (trips.vehicleType, already exposed to Passenger as
 *    PassengerShuttleTrip.vehicleType via the /session/active snapshot)
 *
 * No Sedan/SUV/body-type distinction — out of scope.
 */

import React from 'react';
import { Image } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export type VehicleIconType = 'car' | 'scooter' | 'delivery' | 'hiace' | 'minibus';

interface VehicleIconProps {
  vehicleType?: VehicleIconType | string | null;
  /** Hex color for the vehicle body, e.g. "#FFFFFF". Falls back to the app's
   *  existing route-blue when missing/invalid so the icon never disappears. */
  colorHex?: string | null;
  size?: number;
}

// Existing app route-blue (matches the prior DriverMarker dot / route polyline)
// — reused as the safe default body color rather than inventing a new one.
const FALLBACK_BODY_COLOR = '#1A73E8';
// Neutral detail tones for windows/tires/small details. Two sets — dark
// details for light/mid body colors, light details for dark body colors —
// picked by resolveDetailColors() below so details stay readable against
// any vehicle color instead of a single fixed tone that can blend into a
// black/navy body.
const DETAIL_DARK = '#1e1e28';
const HUB_DARK = '#3a3f47';
const DETAIL_LIGHT = '#E4E4E8';
const HUB_LIGHT = '#8a8a92';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function resolveBodyColor(colorHex?: string | null): string {
  return colorHex && HEX_COLOR_RE.test(colorHex) ? colorHex : FALLBACK_BODY_COLOR;
}

// Perceived brightness (ITU-R BT.601) of the resolved body color, used only
// to pick a readable detail tone — not exposed, not used for anything else.
function bodyBrightness(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function resolveDetailColors(body: string): { detail: string; hub: string } {
  return bodyBrightness(body) < 100
    ? { detail: DETAIL_LIGHT, hub: HUB_LIGHT }
    : { detail: DETAIL_DARK, hub: HUB_DARK };
}

function resolveVehicleType(vehicleType?: string | null): VehicleIconType {
  return vehicleType === 'scooter' || vehicleType === 'delivery'
      || vehicleType === 'hiace' || vehicleType === 'minibus'
    ? vehicleType
    : 'car';
}

/** Normalizes either data axis into a VehicleIconType:
 *   - ride service type: car / scooter / delivery
 *   - shuttle trip vehicle type: hiace / minibus (passed straight through —
 *     these already match VehicleIconType exactly, no mapping needed)
 *   - the generic 'shuttle' ride-level string, when no specific trip vehicle
 *     type is known yet, falls back to the more common 'minibus' silhouette;
 *     callers that have PassengerShuttleTrip.vehicleType should pass that
 *     ('hiace'/'minibus') directly instead of 'shuttle'. */
export function mapServiceTypeToVehicleType(
  serviceType?: string | null,
): VehicleIconType {
  switch (serviceType) {
    case 'scooter': return 'scooter';
    case 'delivery': return 'delivery';
    case 'hiace': return 'hiace';
    case 'minibus': return 'minibus';
    case 'shuttle': return 'minibus';
    default: return 'car';
  }
}

interface ShapeProps {
  body: string;
  detail: string;
  hub: string;
}

// Shared wheel: tire + a small lighter/darker hub dot (contrast-aware, not a
// gradient) for a touch of realism without extra shape complexity.
function Wheel({ cx, cy, r, detail, hub }: { cx: number; cy: number; r: number; detail: string; hub: string }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} fill={detail} />
      <Circle cx={cx} cy={cy} r={r * 0.35} fill={hub} />
    </>
  );
}

// Moped/Vespa-style silhouette (rounded rear seat/body + low footboard +
// tapered front leg-shield + handlebar) built from a few overlapping rounded
// shapes rather than one thin outline — a single-path motorcycle-fork
// silhouette collapses into an unreadable sliver at icon sizes, this doesn't.
function ScooterBody({ body, detail }: { body: string; detail: string }) {
  return (
    <>
      <Rect x={3} y={17} width={14} height={10} rx={5} fill={body} />
      <Rect x={13} y={22} width={16} height={4.2} rx={2.1} fill={body} />
      <Path
        d="M22 26
           C22 20.5 22.4 14 24.7 10.8
           C25.6 9.5 29.6 9.5 30.6 10.8
           C32.7 13.8 33 20.3 33 26
           Z"
        fill={body}
      />
      <Rect x={23} y={7} width={8.5} height={2.4} rx={1.2} fill={detail} />
    </>
  );
}

function ScooterShape({ body, detail, hub }: ShapeProps) {
  return (
    <>
      <Wheel cx={9} cy={29} r={4.2} detail={detail} hub={hub} />
      <Wheel cx={28} cy={29} r={4.2} detail={detail} hub={hub} />
      <ScooterBody body={body} detail={detail} />
    </>
  );
}

// Same scooter body, plus a neutral delivery box mounted behind/above the
// rear seat (drawn first, so the seat's rounded edge overlaps its front) —
// never a van.
function DeliveryShape({ body, detail, hub }: ShapeProps) {
  return (
    <>
      <Wheel cx={9} cy={29} r={4.2} detail={detail} hub={hub} />
      <Wheel cx={28} cy={29} r={4.2} detail={detail} hub={hub} />
      <Rect x={0} y={12.5} width={10} height={11} rx={1.8} fill={detail} />
      <Rect x={0} y={16.8} width={10} height={1.4} fill={hub} />
      <ScooterBody body={body} detail={detail} />
    </>
  );
}

// 14-seat microbus (shuttle trip vehicleType "hiace") — short one-box van
// silhouette: minimal hood, tall boxy cabin, 2 windows. Visually shorter and
// narrower than the 28-seat minibus below.
function HiaceShape({ body, detail, hub }: ShapeProps) {
  return (
    <>
      <Path
        d="M8 26
           L10 26
           Q11.5 22 13 22
           Q14.5 22 16 26
           L24 26
           Q25.5 22 27 22
           Q28.5 22 30 26
           L32 26
           Q34 24 33 19
           C32.5 15 32.3 12 32 10
           C28 8.7 24 8.3 21 8.3
           C17 8.3 12.5 8.6 10 9.3
           Q8.5 9.7 8 13
           Q7 19.5 8 26
           Z"
        fill={body}
      />
      <Path d="M9.3 14 L9.8 10.3 L15.5 10 L15.5 15 Z" fill={detail} />
      <Rect x={19} y={10.5} width={8} height={5} rx={1} fill={detail} />
      <Wheel cx={13} cy={28} r={4.3} detail={detail} hub={hub} />
      <Wheel cx={27} cy={28} r={4.3} detail={detail} hub={hub} />
    </>
  );
}

// 28-seat minibus (shuttle trip vehicleType "minibus") — same one-box family
// as Hiace but a longer body and 4 windows (1 windshield + 3 side), so the
// two are clearly distinguishable at small icon sizes.
function MinibusShape({ body, detail, hub }: ShapeProps) {
  return (
    <>
      <Path
        d="M4 26
           L6 26
           Q7.5 22 9 22
           Q10.5 22 12 26
           L27 26
           Q28.5 22 30 22
           Q31.5 22 33 26
           L36 26
           Q37.5 24 36.5 19
           C36 15 35.8 12 35.5 10
           C30 8.5 24 8.2 20 8.2
           C14 8.2 8 8.6 5 9.3
           Q3.5 9.7 3 13
           Q2 19.5 3 26
           Z"
        fill={body}
      />
      <Path d="M5 13.5 L5.5 10 L11 9.5 L11 15 Z" fill={detail} />
      <Rect x={14} y={10.5} width={5.5} height={5} rx={1} fill={detail} />
      <Rect x={20.5} y={10.2} width={5.5} height={5} rx={1} fill={detail} />
      <Rect x={27} y={10.2} width={5.5} height={5} rx={1} fill={detail} />
      <Wheel cx={9} cy={28} r={4.3} detail={detail} hub={hub} />
      <Wheel cx={31} cy={28} r={4.3} detail={detail} hub={hub} />
    </>
  );
}

const SHAPES: Record<Exclude<VehicleIconType, 'car'>, (props: ShapeProps) => React.JSX.Element> = {
  scooter: ScooterShape,
  delivery: DeliveryShape,
  hiace: HiaceShape,
  minibus: MinibusShape,
};

// ─── CAR: real PNG assets, one per VeeGo vehicle_colors catalog entry ───────
// (assets/images/vehicles/car/car-<name>.png — cropped/normalized real
// vehicle renders, not drawn). Static requires: Metro's bundler needs
// literal require() paths to resolve assets, so this can't be built from a
// template string — every catalog color gets one explicit entry.
const CAR_IMAGES = {
  white: require('../../assets/images/vehicles/car/car-white.png'),
  black: require('../../assets/images/vehicles/car/car-black.png'),
  gray: require('../../assets/images/vehicles/car/car-gray.png'),
  silver: require('../../assets/images/vehicles/car/car-silver.png'),
  red: require('../../assets/images/vehicles/car/car-red.png'),
  blue: require('../../assets/images/vehicles/car/car-blue.png'),
  green: require('../../assets/images/vehicles/car/car-green.png'),
  brown: require('../../assets/images/vehicles/car/car-brown.png'),
  beige: require('../../assets/images/vehicles/car/car-beige.png'),
  gold: require('../../assets/images/vehicles/car/car-gold.png'),
  'dark-blue': require('../../assets/images/vehicles/car/car-dark-blue.png'),
  'pearl-white': require('../../assets/images/vehicles/car/car-pearl-white.png'),
} as const;

type CarColorKey = keyof typeof CAR_IMAGES;

// Same 12 hex values as the VeeGo vehicle_colors catalog (nameEn -> hex),
// used only to pick the nearest available CAR asset — never to recolor one.
const CAR_COLOR_CATALOG: Record<CarColorKey, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  gray: [128, 128, 128],
  silver: [192, 192, 192],
  red: [255, 0, 0],
  blue: [0, 0, 255],
  green: [0, 128, 0],
  brown: [139, 69, 19],
  beige: [245, 245, 220],
  gold: [255, 215, 0],
  'dark-blue': [13, 27, 75],
  'pearl-white': [248, 246, 240],
};

function hexToRgb(hex: string): [number, number, number] {
  const full = hex.length === 4
    ? hex.slice(1).split('').map((c) => c + c).join('')
    : hex.slice(1);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Maps an arbitrary colorHex onto the closest of the 12 CAR asset colors
 *  (exact catalog hex matches resolve immediately; anything else — a
 *  slightly different hex, a future catalog edit — falls back to nearest
 *  by Euclidean RGB distance rather than failing to render). */
function nearestCarColorKey(hex: string): CarColorKey {
  const [r, g, b] = hexToRgb(hex);
  let best: CarColorKey = 'white';
  let bestDist = Infinity;
  for (const key of Object.keys(CAR_COLOR_CATALOG) as CarColorKey[]) {
    const [cr, cg, cb] = CAR_COLOR_CATALOG[key];
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return best;
}

export const VehicleIcon = React.memo(function VehicleIcon({
  vehicleType,
  colorHex,
  size = 28,
}: VehicleIconProps): React.JSX.Element {
  const body = resolveBodyColor(colorHex);
  const type = resolveVehicleType(vehicleType);

  if (type === 'car') {
    const key = nearestCarColorKey(body);
    return (
      <Image
        source={CAR_IMAGES[key]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  const { detail, hub } = resolveDetailColors(body);
  const Shape = SHAPES[type];

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Shape body={body} detail={detail} hub={hub} />
    </Svg>
  );
});
