/**
 * VehicleIcon
 *
 * Shared, flat, professional vehicle silhouette used by both the ride card
 * (DriverAssignedCard) and the live map marker (DriverMarker). Deliberately
 * hand-drawn with react-native-svg (already a project dependency) instead of
 * pulling in a new icon/asset library or per-model/per-color image assets —
 * the body is the only part driven by color, wheels/windows stay a fixed
 * neutral dark tone across every vehicle type.
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
// Matches the app's existing dark "ink" tone (same value already used for the
// DriverAssignedCard primary-button gradient) — kept fixed across themes so
// wheels/windows always read as neutral dark, per design requirement.
const DETAIL_COLOR = '#1e1e28';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function resolveBodyColor(colorHex?: string | null): string {
  return colorHex && HEX_COLOR_RE.test(colorHex) ? colorHex : FALLBACK_BODY_COLOR;
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

function CarShape({ body }: { body: string }) {
  return (
    <>
      <Rect x={5} y={21} width={30} height={8} rx={3} fill={body} />
      <Path d="M12 21 L16 12 L24 12 L28 21 Z" fill={body} />
      <Path d="M14 19 L17 14 L23 14 L26 19 Z" fill={DETAIL_COLOR} />
      <Circle cx={12} cy={30} r={4.2} fill={DETAIL_COLOR} />
      <Circle cx={28} cy={30} r={4.2} fill={DETAIL_COLOR} />
    </>
  );
}

// Shared frame/wheel geometry for the scooter and delivery (scooter + box)
// silhouettes — delivery must read as the same scooter, not a van.
const SCOOTER_FRAME_PATH =
  'M8 30 L8 26 C8 23.5 10 22 12.5 22 L20 22 C21.5 22 22.5 21 22.5 19.5' +
  ' L22.5 16 C22.5 14.5 23.5 13.5 25 13.5 L28.5 13.5 C30 13.5 31 14.5 31 16' +
  ' L31 22 C33.5 22.5 35 24.5 35 27 L35 30 Z';

function ScooterWheels() {
  return (
    <>
      <Circle cx={10} cy={30} r={4} fill={DETAIL_COLOR} />
      <Circle cx={30} cy={30} r={4} fill={DETAIL_COLOR} />
    </>
  );
}

function ScooterShape({ body }: { body: string }) {
  return (
    <>
      <Path d={SCOOTER_FRAME_PATH} fill={body} />
      <ScooterWheels />
    </>
  );
}

// Same scooter body/frame, plus a neutral delivery box mounted on the rear
// rack (drawn first, so the frame overlaps its front edge) — never a van.
function DeliveryShape({ body }: { body: string }) {
  return (
    <>
      <Rect x={2} y={13} width={10} height={10} rx={1.5} fill={DETAIL_COLOR} />
      <Path d={SCOOTER_FRAME_PATH} fill={body} />
      <ScooterWheels />
    </>
  );
}

// 14-seat microbus (shuttle trip vehicleType "hiace") — shorter/narrower box
// with 2 windows, visually distinct from the 28-seat minibus below.
function HiaceShape({ body }: { body: string }) {
  return (
    <>
      <Rect x={9} y={9} width={22} height={14} rx={2.5} fill={body} />
      <Rect x={13} y={12} width={6} height={5} rx={1} fill={DETAIL_COLOR} />
      <Rect x={21} y={12} width={6} height={5} rx={1} fill={DETAIL_COLOR} />
      <Circle cx={15} cy={30} r={4.2} fill={DETAIL_COLOR} />
      <Circle cx={25} cy={30} r={4.2} fill={DETAIL_COLOR} />
    </>
  );
}

// 28-seat minibus (shuttle trip vehicleType "minibus") — longer box, 3 windows.
function MinibusShape({ body }: { body: string }) {
  return (
    <>
      <Rect x={3} y={8} width={34} height={15} rx={2.5} fill={body} />
      <Rect x={7} y={11} width={6} height={5} rx={1} fill={DETAIL_COLOR} />
      <Rect x={15} y={11} width={6} height={5} rx={1} fill={DETAIL_COLOR} />
      <Rect x={23} y={11} width={6} height={5} rx={1} fill={DETAIL_COLOR} />
      <Circle cx={11} cy={30} r={4.2} fill={DETAIL_COLOR} />
      <Circle cx={29} cy={30} r={4.2} fill={DETAIL_COLOR} />
    </>
  );
}

const SHAPES: Record<VehicleIconType, (props: { body: string }) => React.JSX.Element> = {
  car: CarShape,
  scooter: ScooterShape,
  delivery: DeliveryShape,
  hiace: HiaceShape,
  minibus: MinibusShape,
};

export const VehicleIcon = React.memo(function VehicleIcon({
  vehicleType,
  colorHex,
  size = 28,
}: VehicleIconProps): React.JSX.Element {
  const body = resolveBodyColor(colorHex);
  const type = resolveVehicleType(vehicleType);
  const Shape = SHAPES[type];

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Shape body={body} />
    </Svg>
  );
});
