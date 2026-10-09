/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GltfAccessor, GltfBuffer, GltfBufferViewProps, GltfDictionary, GltfDocument, GltfId, GltfMeshPrimitive } from "../../common/gltf/GltfSchema";

/** Two RGBA32UI texels per splat: float means, covariance normalization, half covariance and RGBA8.
 * Means are relative to origin; origin and bounds retain double precision.
 * @internal
 */
export interface GaussianSplatData {
  data: Uint32Array;
  /** Degree-aware float coefficients, including DC when degree is nonzero. */
  sh: Float32Array;
  /** Full precision covariance only when half precision cannot preserve the smallest axis. */
  covariance?: Float32Array;
  /** Exact color/opacity when the byte representation would change supported semantics. */
  appearance?: Float32Array;
  count: number;
  shDegree: number;
  colorSpace: "srgb_rec709_display" | "lin_rec709_display";
  origin: [number, number, number];
  bounds: [number, number, number, number, number, number];
  antialiased?: boolean;
  /** Draft Cesium SPZ content uses depth; ratified content defaults to cameraDistance. */
  sortingMethod?: "cameraDistance" | "viewDepth";
}

/** @internal */
export const gaussianSplatStride = 8;

/** @internal */
export interface GaussianSplatSource {
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
  opacities: Float32Array;
  sh: Float32Array;
  shDegree: number;
  colorSpace: GaussianSplatData["colorSpace"];
  antialiased?: boolean;
  /** Draft Cesium SPZ content uses depth; ratified content defaults to cameraDistance. */
  sortingMethod?: "cameraDistance" | "viewDepth";
}

/** @internal */
export type GaussianSplatDecodeRequest = GaussianSplatSource | {
  spz: Uint8Array;
  count: number;
  colorSpace: GaussianSplatData["colorSpace"];
  /** Cesium's established draft profile preserves the SPZ file's coordinate convention. */
  coordinateSystem?: "LUF" | "UNSPECIFIED";
};

/** @internal */
export function gaussianSplatError(message: string): never {
  throw new Error(`Gaussian splats: ${message}`);
}

type Buffers = GltfDictionary<GltfBuffer & { resolvedBuffer?: Uint8Array }>;
type Views = GltfDictionary<GltfBufferViewProps & { resolvedBuffer?: Uint8Array }>;

function integer(n: number | undefined, label: string): number {
  if (undefined === n || !Number.isSafeInteger(n) || n < 0)
    gaussianSplatError(`invalid ${label}`);

  return n;
}

function viewBytes(id: GltfId, buffers: Buffers, views: Views): Uint8Array {
  const bv = views[id];
  if (!bv)
    gaussianSplatError("missing buffer view");

  const length = integer(bv.byteLength, "buffer view length");
  const offset = bv.resolvedBuffer ? 0 : integer(bv.byteOffset ?? 0, "buffer view offset");
  const bytes = bv.resolvedBuffer ?? buffers[bv.buffer]?.resolvedBuffer;
  if (!bytes || offset + length > bytes.byteLength)
    gaussianSplatError("buffer view exceeds its buffer");

  return bytes.subarray(offset, offset + length);
}

const componentSizes: { [type: number]: number | undefined } = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function component(dv: DataView, offset: number, type: number, normalized: boolean): number {
  switch (type) {
    case 5120: return normalized ? Math.max(-1, dv.getInt8(offset) / 127) : dv.getInt8(offset);
    case 5121: return normalized ? dv.getUint8(offset) / 255 : dv.getUint8(offset);
    case 5122: return normalized ? Math.max(-1, dv.getInt16(offset, true) / 32767) : dv.getInt16(offset, true);
    case 5123: return normalized ? dv.getUint16(offset, true) / 65535 : dv.getUint16(offset, true);
    case 5125: return dv.getUint32(offset, true);
    case 5126: return dv.getFloat32(offset, true);
    default: return gaussianSplatError("invalid accessor component type");
  }
}

/** Read bounded, strided, normalized or sparse glTF data. Never reinterpret unaligned bytes as float arrays.
 * @internal
 */
export function readGaussianSplatAccessor(accessor: GltfAccessor, components: number, buffers: Buffers, views: Views): Float32Array {
  const count = integer(accessor.count, "accessor count");
  if (count === 0 || count > 16 * 1024 * 1024 || accessor.type !== (components === 1 ? "SCALAR" : `VEC${components}`))
    gaussianSplatError("invalid accessor shape or count");

  const type = accessor.componentType ?? 0;
  const size = componentSizes[type];
  if (!size || (accessor.normalized && (type === 5125 || type === 5126)))
    gaussianSplatError("invalid normalized accessor");

  const out = new Float32Array(count * components);
  const read = (bytes: Uint8Array, offset: number, stride: number, num: number, write: (i: number, c: number, value: number) => void) => {
    if (stride < components * size || stride % size || offset % size || offset + (num - 1) * stride + components * size > bytes.byteLength)
      gaussianSplatError("accessor exceeds its buffer view or has invalid alignment");

    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < num; i++)
      for (let c = 0; c < components; c++) {
        const value = component(dv, offset + i * stride + c * size, type, !!accessor.normalized);
        if (!Number.isFinite(value))
          gaussianSplatError("non-finite accessor value");

        write(i, c, value);
      }
  };

  if (accessor.bufferView !== undefined) {
    const bv = views[accessor.bufferView]!;
    read(viewBytes(accessor.bufferView, buffers, views), integer(accessor.byteOffset ?? 0, "accessor offset"), bv.byteStride ?? components * size, count,
      (i, c, value) => { out[i * components + c] = value; });
  } else if (!accessor.sparse) {
    gaussianSplatError("accessor has no storage");
  }

  if (accessor.sparse) {
    const sparse = accessor.sparse as { count: number, indices: { bufferView: GltfId, byteOffset?: number, componentType: number }, values: { bufferView: GltfId, byteOffset?: number } };
    const n = integer(sparse.count, "sparse count");
    if (n === 0 || n > count || !sparse.indices || !sparse.values || ![5121, 5123, 5125].includes(sparse.indices.componentType))
      gaussianSplatError("invalid sparse accessor");

    const indices = viewBytes(sparse.indices.bufferView, buffers, views);
    const offset = integer(sparse.indices.byteOffset ?? 0, "sparse indices offset");
    const indexSize = componentSizes[sparse.indices.componentType]!;
    if (offset % indexSize || offset + n * indexSize > indices.byteLength)
      gaussianSplatError("sparse indices exceed buffer view");

    const dv = new DataView(indices.buffer, indices.byteOffset, indices.byteLength);
    const destination = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const index = component(dv, offset + i * indexSize, sparse.indices.componentType, false);
      if (index >= count || (i > 0 && index <= destination[i - 1]))
        gaussianSplatError("sparse indices must be increasing and in range");

      destination[i] = index;
    }

    read(viewBytes(sparse.values.bufferView, buffers, views), integer(sparse.values.byteOffset ?? 0, "sparse values offset"), components * size, n,
      (i, c, value) => { out[destination[i] * components + c] = value; });
  }

  return out;
}

/** Validate the supported extension profile and extract data to transfer to the decoder worker.
 * @internal
 */
export function readGaussianSplatSource(primitive: GltfMeshPrimitive, document: GltfDocument, buffers: Buffers, views: Views): GaussianSplatDecodeRequest {
  const ext = primitive.extensions?.KHR_gaussian_splatting as {
    kernel?: string, colorSpace?: string, projection?: string, sortingMethod?: string,
    extensions?: { [name: string]: { bufferView: GltfId } | undefined },
  } | undefined;
  if (!ext || primitive.mode !== 0 || primitive.indices !== undefined || primitive.targets || primitive.extensions?.KHR_spz_gaussian_splats_compression)
    gaussianSplatError("expected an unindexed POINTS primitive with KHR_gaussian_splatting");

  const compression = ext.extensions?.KHR_gaussian_splatting_compression_spz_2;
  // Cesium 1.146/ion's established draft has COLOR_0 placeholders and no kernel/colorSpace or degree-zero SH.
  // Preserve that profile's coordinate convention; standards-based content explicitly decodes to glTF LUF.
  const cesiumDraft = !!compression && ext.kernel === undefined && ext.colorSpace === undefined &&
    primitive.attributes.COLOR_0 !== undefined && primitive.attributes["KHR_gaussian_splatting:SH_DEGREE_0_COEF_0"] === undefined;
  const kernel = ext.kernel ?? (cesiumDraft ? "ellipse" : undefined);
  const colorSpace = ext.colorSpace ?? (cesiumDraft ? "srgb_rec709_display" : undefined);
  if (kernel !== "ellipse" || !["srgb_rec709_display", "lin_rec709_display"].includes(colorSpace ?? "") ||
    (ext.projection !== undefined && ext.projection !== "perspective") ||
    (ext.sortingMethod !== undefined && ext.sortingMethod !== "cameraDistance"))
    gaussianSplatError("unsupported kernel, color space, projection or sorting method");

  const accessors = document.accessors ?? {};
  const positionId = primitive.attributes.POSITION;
  const positionAccessor = positionId !== undefined ? accessors[positionId] : undefined;
  if (!positionAccessor)
    gaussianSplatError("missing POSITION");

  if (compression) {
    const count = integer(positionAccessor.count, "compressed splat count");
    if (count === 0 || count > 16 * 1024 * 1024)
      gaussianSplatError("invalid compressed splat count");

    for (const id of Object.values(primitive.attributes))
      if (id === undefined || accessors[id]?.count !== count)
        gaussianSplatError("compressed accessor counts must match POSITION");

    return {
      spz: viewBytes(compression.bufferView, buffers, views).slice(), count,
      colorSpace: colorSpace as GaussianSplatData["colorSpace"], coordinateSystem: cesiumDraft ? "UNSPECIFIED" : "LUF",
    };
  }

  const read = (name: string, n: number, allowed: number[]) => {
    const id = primitive.attributes[name];
    const accessor = id !== undefined ? accessors[id] : undefined;
    if (!accessor || accessor.count !== positionAccessor.count || !allowed.includes(accessor.componentType ?? 0))
      gaussianSplatError(`missing or invalid ${name}`);

    return readGaussianSplatAccessor(accessor, n, buffers, views);
  };
  const positions = read("POSITION", 3, [5120, 5121, 5122, 5123, 5126]);
  const rotations = read("KHR_gaussian_splatting:ROTATION", 4, [5120, 5122, 5126]);
  const scales = read("KHR_gaussian_splatting:SCALE", 3, [5121, 5123, 5126]);
  const opacities = read("KHR_gaussian_splatting:OPACITY", 1, [5121, 5123, 5126]);
  for (const name of ["KHR_gaussian_splatting:ROTATION", "KHR_gaussian_splatting:OPACITY"]) {
    const accessor = accessors[primitive.attributes[name]!]!;
    if (accessor.componentType !== 5126 && !accessor.normalized)
      gaussianSplatError(`${name} integer values must be normalized`);
  }
  let shDegree = 0;
  for (let degree = 1; degree <= 3; degree++)
    if (Object.keys(primitive.attributes).some((name) => name.startsWith(`KHR_gaussian_splatting:SH_DEGREE_${degree}_`)))
      shDegree = degree;

  const stride = (shDegree + 1) ** 2 * 3;
  const sh = new Float32Array(positionAccessor.count * stride);
  let coefficient = 0;
  for (let degree = 0; degree <= shDegree; degree++)
    for (let c = 0; c < 2 * degree + 1; c++, coefficient++) {
      const values = read(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${c}`, 3, [5126]);
      for (let i = 0; i < positionAccessor.count; i++)
        sh.set(values.subarray(i * 3, i * 3 + 3), i * stride + coefficient * 3);
    }

  const shNames = Object.keys(primitive.attributes).filter((name) => name.startsWith("KHR_gaussian_splatting:SH_"));
  if (shNames.length !== coefficient)
    gaussianSplatError("incomplete or unsupported spherical harmonics");

  return { positions, rotations, scales, opacities, sh, shDegree, colorSpace: colorSpace as GaussianSplatData["colorSpace"] };
}
