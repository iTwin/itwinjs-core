/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GltfDataType } from "../../common/gltf/GltfSchema";
import {
  checkGaussianSplatDecodeLimits, GaussianSplatAccessor, GaussianSplatAttributesRequest, gaussianSplatRequestInputBytes,
  GaussianSplatSource, maxGaussianSplatsPerTile,
} from "../../internal/render/GaussianSplatData";
import { gaussianSplatError } from "../../internal/render/GaussianSplatError";

const componentSizes: { [type: number]: number | undefined } = {
  [GltfDataType.SignedByte]: 1, [GltfDataType.UnsignedByte]: 1, [GltfDataType.SignedShort]: 2,
  [GltfDataType.UnsignedShort]: 2, [GltfDataType.UInt32]: 4, [GltfDataType.Float]: 4,
};

const sparseIndexTypes: number[] = [GltfDataType.UnsignedByte, GltfDataType.UnsignedShort, GltfDataType.UInt32];

function readComponent(view: DataView, byteOffset: number, type: number, normalized: boolean): number {
  switch (type) {
    case GltfDataType.SignedByte: return normalized ? Math.max(-1, view.getInt8(byteOffset) / 127) : view.getInt8(byteOffset);
    case GltfDataType.UnsignedByte: return normalized ? view.getUint8(byteOffset) / 255 : view.getUint8(byteOffset);
    case GltfDataType.SignedShort: return normalized ? Math.max(-1, view.getInt16(byteOffset, true) / 32767) : view.getInt16(byteOffset, true);
    case GltfDataType.UnsignedShort: return normalized ? view.getUint16(byteOffset, true) / 65535 : view.getUint16(byteOffset, true);
    case GltfDataType.UInt32: return view.getUint32(byteOffset, true);
    case GltfDataType.Float: return view.getFloat32(byteOffset, true);
    default: return gaussianSplatError("invalid accessor component type");
  }
}

function requestView(views: Uint8Array[], index: number): Uint8Array {
  const view = views[index];
  if (!view)
    gaussianSplatError("missing buffer view");

  return view;
}

/** Read bounded, strided, normalized or sparse glTF data. Never reinterpret unaligned bytes as float arrays. */
function readGaussianSplatAccessor(accessor: GaussianSplatAccessor, views: Uint8Array[]): Float32Array {
  const { count, components, componentType: type, normalized } = accessor;
  if (!Number.isSafeInteger(count) || count <= 0 || count > maxGaussianSplatsPerTile)
    gaussianSplatError("invalid accessor count");

  const size = componentSizes[type];
  if (!size || (normalized && (type === GltfDataType.UInt32 || type === GltfDataType.Float)))
    gaussianSplatError("invalid normalized accessor");

  const values = new Float32Array(count * components);
  const elementSize = components * size;

  /** Copy `numElements` elements starting at `byteOffset` of `bytes` to the elements `destination(i)` of `values`. */
  const copyElements = (bytes: Uint8Array, byteOffset: number, byteStride: number, numElements: number, destination: (element: number) => number) => {
    if (byteStride < elementSize || byteStride % size || byteOffset % size || byteOffset + (numElements - 1) * byteStride + elementSize > bytes.byteLength)
      gaussianSplatError("accessor exceeds its buffer view or has invalid alignment");

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let element = 0; element < numElements; element++) {
      for (let component = 0; component < components; component++) {
        const value = readComponent(view, byteOffset + element * byteStride + component * size, type, normalized);
        if (!Number.isFinite(value))
          gaussianSplatError("non-finite accessor value");

        values[destination(element) * components + component] = value;
      }
    }
  };

  const { elements, sparse } = accessor;
  if (elements)
    copyElements(requestView(views, elements.view), elements.byteOffset, elements.byteStride ?? elementSize, count, (element) => element);
  else if (!sparse)
    gaussianSplatError("accessor has no storage");

  if (sparse) {
    const sparseCount = sparse.count;
    const indexType = sparse.indices.componentType;
    const indexSize = sparseIndexTypes.includes(indexType) ? componentSizes[indexType] : undefined;
    if (!Number.isSafeInteger(sparseCount) || sparseCount <= 0 || sparseCount > count || !indexSize)
      gaussianSplatError("invalid sparse accessor");

    const indexBytes = requestView(views, sparse.indices.view);
    const indexOffset = sparse.indices.byteOffset;
    if (indexOffset % indexSize || indexOffset + sparseCount * indexSize > indexBytes.byteLength)
      gaussianSplatError("sparse indices exceed buffer view");

    const indexView = new DataView(indexBytes.buffer, indexBytes.byteOffset, indexBytes.byteLength);
    const indices = new Uint32Array(sparseCount);
    for (let i = 0; i < sparseCount; i++) {
      const index = readComponent(indexView, indexOffset + i * indexSize, indexType, false);
      if (index >= count || (i > 0 && index <= indices[i - 1]))
        gaussianSplatError("sparse indices must be increasing and in range");

      indices[i] = index;
    }

    copyElements(requestView(views, sparse.values.view), sparse.values.byteOffset, elementSize, sparseCount, (element) => indices[element]);
  }

  return values;
}

/** Read uncompressed splat attributes into the arrays packing reads, interleaving each splat's SH coefficients: DC first, then each
 * band in order, RGB per coefficient. The limits are checked before anything is allocated.
 * @internal
 */
export function readGaussianSplatAttributes(request: GaussianSplatAttributesRequest): GaussianSplatSource {
  const { count, shDegree, views } = request;
  checkGaussianSplatDecodeLimits(count, shDegree, gaussianSplatRequestInputBytes(request));
  const shFloatsPerSplat = (shDegree + 1) ** 2 * 3;
  if (request.sh.length * 3 !== shFloatsPerSplat)
    gaussianSplatError("incomplete or unsupported spherical harmonics");

  const read = (accessor: GaussianSplatAccessor) => {
    if (accessor.count !== count)
      gaussianSplatError("accessor counts must match POSITION");

    return readGaussianSplatAccessor(accessor, views);
  };

  const sh = new Float32Array(count * shFloatsPerSplat);
  request.sh.forEach((accessor, coefficient) => {
    const values = read(accessor);
    for (let i = 0; i < count; i++)
      sh.set(values.subarray(i * 3, i * 3 + 3), i * shFloatsPerSplat + coefficient * 3);
  });

  return {
    positions: read(request.positions),
    rotations: read(request.rotations),
    scales: read(request.scales),
    opacities: read(request.opacities),
    sh,
    shDegree,
    colorSpace: request.colorSpace,
  };
}
