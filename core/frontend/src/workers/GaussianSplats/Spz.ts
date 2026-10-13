/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GaussianSplatSource, spzBodyBytesPerSplat } from "../../internal/render/GaussianSplatData";
import { gaussianSplatError } from "../../internal/render/GaussianSplatError";

/** The header of a decompressed SPZ payload (https://github.com/nianticlabs/spz). @internal */
export interface SpzHeader {
  /** 2: rotations store x, y and z; 3: rotations store the three smallest components. */
  version: number;
  count: number;
  shDegree: number;
  /** Fractional bits of the 24-bit fixed-point positions. */
  fractionalBits: number;
  antialiased: boolean;
}

/** A decompressed SPZ payload: its header and the bytes that follow it. @internal */
export interface SpzPayload {
  header: SpzHeader;
  body: Uint8Array;
}

/** The coordinate system to decode into. SPZ stores right-up-back (RUB) coordinates; "UNSPECIFIED" keeps them as stored. @internal */
export type SpzCoordinateSystem = "LUF" | "UNSPECIFIED";

/** "NGSP", little-endian. */
const spzMagic = 0x5053474e;
const spzHeaderBytes = 16;
const maxFractionalBits = 24;

/** SH coefficients per color channel above degree 0, by degree. */
const higherShCoefficients = [0, 3, 8, 15];

function readSpzHeader(bytes: Uint8Array): SpzHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, spzHeaderBytes);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const shDegree = bytes[12], fractionalBits = bytes[13], flags = bytes[14];
  const supported = magic === spzMagic && (version === 2 || version === 3) && shDegree <= 3 && fractionalBits <= maxFractionalBits;
  if (!supported)
    gaussianSplatError("invalid or unsupported SPZ header");

  return { version, count, shDegree, fractionalBits, antialiased: (flags & 1) !== 0 };
}

/** Decompress an SPZ payload. `validate` sees the header before the body is allocated, and may throw to reject the tile. The
 * body must be exactly as long as the header says: more data is rejected as soon as it arrives, so that a small payload cannot
 * inflate without bound (a decompression bomb).
 * @internal
 */
export async function inflateSpz(compressed: Uint8Array, validate: (header: SpzHeader) => void): Promise<SpzPayload> {
  const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const headerBytes = new Uint8Array(spzHeaderBytes);
  let headerLength = 0;
  let payload: SpzPayload | undefined;
  let bodyLength = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      let bytes = chunk.value;
      if (!payload) {
        const headerPart = bytes.subarray(0, spzHeaderBytes - headerLength);
        headerBytes.set(headerPart, headerLength);
        headerLength += headerPart.length;
        bytes = bytes.subarray(headerPart.length);
        if (headerLength < spzHeaderBytes)
          continue;

        const header = readSpzHeader(headerBytes);
        validate(header);
        payload = { header, body: new Uint8Array(header.count * spzBodyBytesPerSplat(header.version, header.shDegree)) };
      }

      if (bodyLength + bytes.length > payload.body.length)
        gaussianSplatError("SPZ payload inflates beyond the size its header declares");

      payload.body.set(bytes, bodyLength);
      bodyLength += bytes.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (!payload || bodyLength !== payload.body.length)
    gaussianSplatError("truncated SPZ payload");

  return payload;
}

/** Sign flips that convert SPZ's RUB coordinates to glTF's LUF: positions and quaternion x, y, z, and the 15 higher SH coefficients. */
const lufFlips = {
  axes: [-1, 1, -1],
  sh: [1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1],
};
const noFlips = {
  axes: [1, 1, 1],
  sh: Array<number>(15).fill(1),
};

/** SPZ's color byte encodes DC as byte = 255 * (0.15 * dc + 0.5). */
const colorScale = 0.15;
// Float32 constants of the reference decoder, so that rotations come out bit-identical and pack identically.
const rotationStep = Math.fround(1 / 127.5);
const smallestComponentScale = Math.fround(Math.SQRT1_2);
const smallestComponentMask = 511;

/** Unpack a decompressed SPZ payload into activated values: linear scales, opacities in [0, 1], and DC coefficients followed by
 * the higher SH coefficients of each splat.
 * @internal
 */
export function unpackSpz({ header, body }: SpzPayload, coordinateSystem: SpzCoordinateSystem): Omit<GaussianSplatSource, "colorSpace"> {
  const { count, shDegree, fractionalBits, version } = header;
  const flips = coordinateSystem === "LUF" ? lufFlips : noFlips;
  const [flipX, flipY, flipZ] = flips.axes;
  const shCoefficients = higherShCoefficients[shDegree];
  const shFloatsPerSplat = (shCoefficients + 1) * 3;

  const positions = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const scales = new Float32Array(count * 3);
  const opacities = new Float32Array(count);
  const sh = new Float32Array(count * shFloatsPerSplat);

  const alphaStart = count * 9;
  const colorStart = alphaStart + count;
  const scaleStart = colorStart + count * 3;
  const rotationStart = scaleStart + count * 3;
  const rotationBytes = version === 3 ? 4 : 3;
  const shStart = rotationStart + count * rotationBytes;
  const positionScale = 1 / 2 ** fractionalBits;

  // Measured hot loop: one pass per splat with the section offsets inlined.
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const offset = (i * 3 + axis) * 3;
      const fixed = (body[offset] | (body[offset + 1] << 8) | (body[offset + 2] << 16)) << 8 >> 8;
      positions[i * 3 + axis] = fixed * positionScale * flips.axes[axis];
      scales[i * 3 + axis] = Math.exp(body[scaleStart + i * 3 + axis] / 16 - 10);
      sh[i * shFloatsPerSplat + axis] = (body[colorStart + i * 3 + axis] / 255 - 0.5) / colorScale;
    }

    opacities[i] = body[alphaStart + i] / 255;

    const rotationOffset = rotationStart + i * rotationBytes;
    if (version === 3)
      unpackSmallestThreeQuaternion(body, rotationOffset, rotations, i * 4);
    else
      unpackFirstThreeQuaternion(body, rotationOffset, rotations, i * 4);

    rotations[i * 4] *= flipY * flipZ;
    rotations[i * 4 + 1] *= flipX * flipZ;
    rotations[i * 4 + 2] *= flipX * flipY;

    for (let coefficient = 0; coefficient < shCoefficients; coefficient++) {
      const flip = flips.sh[coefficient];
      for (let channel = 0; channel < 3; channel++) {
        const byte = body[shStart + (i * shCoefficients + coefficient) * 3 + channel];
        sh[i * shFloatsPerSplat + 3 + coefficient * 3 + channel] = (byte - 128) / 128 * flip;
      }
    }
  }

  return { positions, rotations, scales, opacities, sh, shDegree, antialiased: header.antialiased };
}

/** SPZ 2 rotations: x, y and z on a 1/127.5 grid; w is non-negative and makes the quaternion unit. */
function unpackFirstThreeQuaternion(body: Uint8Array, offset: number, rotations: Float32Array, start: number): void {
  const x = Math.fround(Math.fround(body[offset] * rotationStep) - 1);
  const y = Math.fround(Math.fround(body[offset + 1] * rotationStep) - 1);
  const z = Math.fround(Math.fround(body[offset + 2] * rotationStep) - 1);
  const squaredNorm = Math.fround(Math.fround(Math.fround(x * x) + Math.fround(y * y)) + Math.fround(z * z));
  rotations[start] = x;
  rotations[start + 1] = y;
  rotations[start + 2] = z;
  rotations[start + 3] = Math.sqrt(Math.max(0, Math.fround(1 - squaredNorm)));
}

/** SPZ 3 rotations: the largest component's index in the top two bits, then the other three, last first, as a 9-bit magnitude
 * of at most 1/sqrt(2) and a sign bit each. The largest component is non-negative and makes the quaternion unit.
 */
function unpackSmallestThreeQuaternion(body: Uint8Array, offset: number, rotations: Float32Array, start: number): void {
  let packed = (body[offset] | (body[offset + 1] << 8) | (body[offset + 2] << 16) | (body[offset + 3] << 24)) >>> 0;
  const largest = packed >>> 30;
  let squaredSum = 0;
  for (let component = 3; component >= 0; component--) {
    if (component === largest)
      continue;

    const magnitude = Math.fround(Math.fround(smallestComponentScale * (packed & smallestComponentMask)) / smallestComponentMask);
    const value = (packed >>> 9) & 1 ? -magnitude : magnitude;
    packed >>>= 10;
    rotations[start + component] = value;
    squaredSum = Math.fround(squaredSum + Math.fround(value * value));
  }

  rotations[start + largest] = Math.sqrt(Math.fround(1 - squaredSum));
}
