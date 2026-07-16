export type Vector3 = readonly [number, number, number];

export type MarkerAnchorPose = {
  readonly position: Vector3;
  readonly rotation: Vector3;
};

export type CameraWorldPose = {
  readonly forward: Vector3;
  readonly position: Vector3;
};

export type MarkerSpacePose = {
  readonly capturedAt: number;
  readonly direction: { readonly x: number; readonly z: number } | null;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
};

export const AIM_POSE_STALE_MS = 1_000;

export function freshAimDirection(
  pose: MarkerSpacePose | null,
  now: number,
): MarkerSpacePose["direction"] {
  if (
    pose === null
    || pose.direction === null
    || now < pose.capturedAt
    || now - pose.capturedAt > AIM_POSE_STALE_MS
  ) {
    return null;
  }
  return pose.direction;
}

const toRadians = (degrees: number) => degrees * Math.PI / 180;

function worldVectorToMarker(vector: Vector3, rotation: Vector3): Vector3 {
  const [rotationX, rotationY, rotationZ] = rotation.map((degrees) => -toRadians(degrees));
  const [inputX, inputY, inputZ] = vector;

  const zCos = Math.cos(rotationZ);
  const zSin = Math.sin(rotationZ);
  const afterZ: Vector3 = [
    zCos * inputX - zSin * inputY,
    zSin * inputX + zCos * inputY,
    inputZ,
  ];

  const yCos = Math.cos(rotationY);
  const ySin = Math.sin(rotationY);
  const afterY: Vector3 = [
    yCos * afterZ[0] + ySin * afterZ[2],
    afterZ[1],
    -ySin * afterZ[0] + yCos * afterZ[2],
  ];

  const xCos = Math.cos(rotationX);
  const xSin = Math.sin(rotationX);
  return [
    afterY[0],
    xCos * afterY[1] - xSin * afterY[2],
    xSin * afterY[1] + xCos * afterY[2],
  ];
}

export function captureMarkerSpacePose(
  marker: MarkerAnchorPose,
  camera: CameraWorldPose,
  capturedAt: number,
): MarkerSpacePose {
  const worldRelativePosition: Vector3 = [
    camera.position[0] - marker.position[0],
    camera.position[1] - marker.position[1],
    camera.position[2] - marker.position[2],
  ];
  const relativePosition = worldVectorToMarker(worldRelativePosition, marker.rotation);
  const relativeForward = worldVectorToMarker(camera.forward, marker.rotation);
  const magnitude = Math.hypot(relativeForward[0], relativeForward[2]);

  return {
    capturedAt,
    direction: magnitude < 0.1
      ? null
      : { x: relativeForward[0] / magnitude, z: relativeForward[2] / magnitude },
    position: { x: relativePosition[0], y: relativePosition[1], z: relativePosition[2] },
  };
}
