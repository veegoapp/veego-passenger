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
 * Matches the existing backend `vehicles.vehicleType` vocabulary: car,
 * scooter, van, minibus. No Sedan/SUV/body-type distinction — out of scope.
 */

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export type VehicleIconType = 'car' | 'scooter' | 'van' | 'minibus';

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
  return vehicleType === 'scooter' || vehicleType === 'van' || vehicleType === 'minibus'
    ? vehicleType
    : 'car';
}

/** Maps the ride/service-type vocabulary already available in the Passenger
 *  app (car/scooter/delivery/shuttle) onto the vehicle-icon vocabulary that
 *  matches the backend's `vehicles.vehicleType` enum (car/scooter/van/minibus).
 *  Used where only a ride's service type is known, not the driver's actual
 *  `vehicles.vehicleType` row. */
export function mapServiceTypeToVehicleType(
  serviceType?: string | null,
): VehicleIconType {
  switch (serviceType) {
    case 'scooter': return 'scooter';
    case 'delivery': return 'van';
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

function ScooterShape({ body }: { body: string }) {
  return (
    <>
      <Path
        d="M8 30 L8 26 C8 23.5 10 22 12.5 22 L20 22 C21.5 22 22.5 21 22.5 19.5
           L22.5 16 C22.5 14.5 23.5 13.5 25 13.5 L28.5 13.5 C30 13.5 31 14.5 31 16
           L31 22 C33.5 22.5 35 24.5 35 27 L35 30 Z"
        fill={body}
      />
      <Circle cx={10} cy={30} r={4} fill={DETAIL_COLOR} />
      <Circle cx={30} cy={30} r={4} fill={DETAIL_COLOR} />
    </>
  );
}

function VanShape({ body }: { body: string }) {
  return (
    <>
      <Rect x={5} y={9} width={27} height={14} rx={2.5} fill={body} />
      <Rect x={25} y={12} width={6} height={6} rx={1} fill={DETAIL_COLOR} />
      <Circle cx={12} cy={30} r={4.2} fill={DETAIL_COLOR} />
      <Circle cx={26} cy={30} r={4.2} fill={DETAIL_COLOR} />
    </>
  );
}

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
  van: VanShape,
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
