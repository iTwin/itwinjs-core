/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  GltfAccessor, GltfBuffer, GltfBufferViewProps, GltfDataType, GltfDictionary, GltfDocument, GltfId, GltfMeshMode, GltfMeshPrimitive,
} from "../../common/gltf/GltfSchema";
import { gaussianSplatError } from "./GaussianSplatError";

/** Two RGBA32UI texels (32 bytes) per splat, with no per-tile supplements:
 *
 * | words | field | encoding |
 * | --- | --- | --- |
 * | 0-2 | mean | float32 xyz relative to `origin` |
 * | 3-4 | rotation | snorm16 xyzw unit quaternion |
 * | 5, 6 (low 16 bits) | scale | 16-bit natural-log code: ln(s) = code / 1024 - 32 |
 * | 6 (bits 16-27), 7 (bits 0-23) | DC color | 12-bit code per channel: dc = (code - 2044) / 306 |
 * | 6 (bits 28-31), 7 (bits 24-31) | opacity | 12-bit code: opacity = code / 4080 |
 *
 * The scale, color and opacity grids contain SPZ's 8-bit grids exactly (SPZ byte b maps to
 * 64b + 22528, 8b + 1024 and 16b), so SPZ content is stored without additional loss. Display color
 * 0.5 + SH_C0 * dc covers about [-1.38, 2.39], keeping overbright values. Covariance is computed
 * from rotation and scale in the vertex shader. The DC step c0 / 306 = 9.2e-4 is fine in display
 * (sRGB) units but coarse near black for linear-space float content; see GaussianSplats.md.
 * Means are relative to origin; origin and bounds retain double precision.
 * @internal
 */
export interface GaussianSplatData {
  data: Uint32Array;
  /** Higher SH bands (degree > 0, DC excluded), padded to [[gaussianSplatShTexels]] RGBA32UI texels per splat.
   * Bytes 0 to [[gaussianSplatShCoefficients]] - 1 hold one byte per coefficient (coefficient-major, then RGB);
   * the next `shDegree` bytes hold each band's exponent code. Coefficient = (byte - 128) * [[decodeGaussianSplatShScale]](exponent).
   * A band on SPZ's 1/128 grid uses exponent [[gaussianSplatShGridExponent]], so SPZ content is exact. Empty for degree 0. */
  sh: Uint32Array;
  count: number;
  shDegree: number;
  colorSpace: "srgb_rec709_display" | "lin_rec709_display";
  origin: [number, number, number];
  bounds: [number, number, number, number, number, number];
  antialiased?: boolean;
  /** Content decoded by [[usesCesiumIonDraftAdapter]] sorts by view depth; other content by camera distance, the default. */
  sortingMethod?: "cameraDistance" | "viewDepth";
}

/** Uint32 words per splat in [[GaussianSplatData.data]]. @internal */
export const gaussianSplatStride = 8;

// The code scales of the compact layout, as literals so that the encoders and decoders below fold them.
const scaleStep = 1024, scaleOffset = 32, colorZero = 2044, colorStep = 306, opacityMax = 4080;

/** The code scales of [[GaussianSplatData.data]]: ln(scale) = code / `scaleStep` - `scaleOffset`, dc = (code - `colorZero`) /
 * `colorStep`, opacity = code / `opacityMax`. The encoders, the CPU decoders and the shader all use these values.
 * @internal
 */
export const gaussianSplatCodes = { scaleStep, scaleOffset, colorZero, colorStep, opacityMax } as const;

/** The most splats a single tile may hold. Larger tiles cannot take part in bounded residency; producers must split them. @internal */
export const maxGaussianSplatsPerTile = 2 * 1024 * 1024;

/** The most bytes decoding a single tile may use at its peak (see [[gaussianSplatDecodeBytes]]). */
const maxGaussianSplatDecodeBytes = 512 * 1024 * 1024;

/** Peak bytes of decoding a tile of `count` splats with SH through `shDegree`, while the worker holds `inputBytes` of its input: the
 * activated float arrays that packing reads (mean, rotation, scale, opacity and every SH coefficient) and the packed output. With float
 * or SPZ input, a tile of [[maxGaussianSplatsPerTile]] splats fits [[maxGaussianSplatDecodeBytes]] at degrees 0 and 1.
 * @internal
 */
export function gaussianSplatDecodeBytes(count: number, shDegree: number, inputBytes: number): number {
  const sourceBytesPerSplat = 4 * (11 + (shDegree + 1) ** 2 * 3);
  const packedBytesPerSplat = 4 * gaussianSplatStride + 16 * gaussianSplatShTexels(shDegree);
  return count * (sourceBytesPerSplat + packedBytesPerSplat) + inputBytes;
}

/** Throws unless a tile of `count` splats with SH through `shDegree` is within the splat and memory limits, given the bytes of its input
 * the worker holds while it decodes. Call it before allocating anything for the tile.
 * @internal
 */
export function checkGaussianSplatDecodeLimits(count: number, shDegree: number, inputBytes: number): void {
  if (!Number.isSafeInteger(count) || count <= 0 || count > maxGaussianSplatsPerTile)
    gaussianSplatError(`a tile must hold between 1 and ${maxGaussianSplatsPerTile} splats`);

  if (gaussianSplatDecodeBytes(count, shDegree, inputBytes) > maxGaussianSplatDecodeBytes)
    gaussianSplatError("tile exceeds the decoder memory limit; split it into smaller tiles");
}

/** Bytes per splat of an SPZ body: 24-bit position, alpha, color, scale, rotation (three bytes in version 2, four in version 3) and
 * higher SH bytes. @internal
 */
export function spzBodyBytesPerSplat(version: number, shDegree: number): number {
  const rotationBytes = version === 3 ? 4 : 3;
  return 9 + 1 + 3 + 3 + rotationBytes + gaussianSplatShCoefficients(shDegree);
}

/** Higher-band SH coefficients (bytes) per splat, excluding DC. @internal */
export function gaussianSplatShCoefficients(degree: number): number {
  return degree > 0 ? ((degree + 1) ** 2 - 1) * 3 : 0;
}

/** RGBA32UI texels per splat of packed higher-band SH bytes and per-band exponents. The coefficient
 * bytes leave room for the exponents in every degree (9 + 1, 24 + 2 and 45 + 3 of 16, 32 and 48 bytes).
 * @internal
 */
export function gaussianSplatShTexels(degree: number): number {
  return degree > 0 ? Math.ceil((gaussianSplatShCoefficients(degree) + degree) / 16) : 0;
}

/** 2^(i/8) for i = 0..7, as GLSL float literals shared by the shader and [[decodeGaussianSplatShScale]]. @internal */
export const gaussianSplatShFractions = ["1.0", "1.0905077326652577", "1.189207115002721", "1.2968395546510096",
  "1.4142135623730951", "1.542210825407941", "1.6817928305074292", "1.8340080864093424"];
const shFractions = gaussianSplatShFractions.map((literal) => Math.fround(Number(literal)));

/** Exponent code of SPZ's 1/128 SH grid: 2^(136/8 - 24) = 2^-7. @internal */
export const gaussianSplatShGridExponent = 136;

/** SH byte step of an 8-bit band exponent code: 2^(code/8 - 24), from 2^-24 to about 235. The value is
 * a power of two times a float32 constant, so the CPU and the shader decode it identically.
 * @internal
 */
export function decodeGaussianSplatShScale(code: number): number {
  return 2 ** ((code >> 3) - 24) * shFractions[code & 7];
}

/** @internal */
export function encodeGaussianSplatScale(scale: number): number {
  return Math.max(0, Math.min(65535, Math.round((Math.log(scale) + scaleOffset) * scaleStep)));
}

/** DC coefficient to a 12-bit code. @internal */
export function encodeGaussianSplatColor(dc: number): number {
  return Math.max(0, Math.min(4095, Math.round(colorStep * dc + colorZero)));
}

/** @internal */
export function encodeGaussianSplatOpacity(opacity: number): number {
  return Math.round(opacity * opacityMax);
}

/** Decode a snorm16 quaternion component as the shader's unpackSnorm2x16 does. @internal */
export function decodeGaussianSplatSnorm(bits: number): number {
  return Math.max(-1, ((bits << 16) >> 16) / 32767);
}

/** Scale of a 16-bit log code. @internal */
export function decodeGaussianSplatScale(code: number): number {
  return Math.exp(code / scaleStep - scaleOffset);
}

/** Activated splats, the input of packing: linear scales, opacities in [0, 1], and for each splat its DC coefficients followed by
 * its higher SH coefficients.
 * @internal
 */
export interface GaussianSplatSource {
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
  opacities: Float32Array;
  sh: Float32Array;
  shDegree: number;
  colorSpace: GaussianSplatData["colorSpace"];
  antialiased?: boolean;
  /** See [[GaussianSplatData.sortingMethod]]. */
  sortingMethod?: "cameraDistance" | "viewDepth";
}

/** A glTF accessor of splat attributes, as the worker reads it from the buffer views copied into its request. @internal */
export interface GaussianSplatAccessor {
  count: number;
  componentType: number;
  normalized: boolean;
  /** 1 (SCALAR), 3 (VEC3) or 4 (VEC4). */
  components: number;
  /** The accessor's elements, if it has any besides its sparse values: an index into the request's views, and where they are. */
  elements?: { view: number, byteOffset: number, byteStride?: number };
  sparse?: {
    count: number;
    indices: { view: number, byteOffset: number, componentType: number };
    values: { view: number, byteOffset: number };
  };
}

/** Uncompressed `KHR_gaussian_splatting` attributes, to be read on the worker. @internal */
export interface GaussianSplatAttributesRequest {
  format: "attributes";
  count: number;
  shDegree: number;
  colorSpace: GaussianSplatData["colorSpace"];
  /** Copies of the buffer views the accessors use; transferred to the worker. */
  views: Uint8Array[];
  positions: GaussianSplatAccessor;
  rotations: GaussianSplatAccessor;
  scales: GaussianSplatAccessor;
  opacities: GaussianSplatAccessor;
  /** The SH coefficients in order: DC, then each band. */
  sh: GaussianSplatAccessor[];
}

/** An SPZ payload, to be decoded on the worker. @internal */
export interface GaussianSplatSpzRequest {
  format: "spz";
  spz: Uint8Array;
  count: number;
  /** The SH degree the glTF attributes declare. The payload's own header decides how it is decoded. */
  shDegree: number;
  colorSpace: GaussianSplatData["colorSpace"];
  /** The primitive's metadata has the draft layout (see [[usesCesiumIonDraftAdapter]]). */
  draftLayout: boolean;
}

/** Whether to decode an SPZ payload as Cesium ion's established draft content, an adapter for content that predates the ratification
 * of its extensions.
 *
 * `KHR_gaussian_splatting_compression_spz_2` is a draft (Khronos glTF pull request 2531, open). It names version 2 of the SPZ format
 * and requires payloads stored in glTF's LUF axes. Its example omits the `kernel` and `colorSpace` that the ratified
 * `KHR_gaussian_splatting` requires, and carries DC colors in a `COLOR_0` placeholder instead of `SH_DEGREE_0_COEF_0`: the draft
 * layout. Cesium ion serves content in the draft layout whose payloads are SPZ version 3 and stored without the LUF conversion. Every
 * ion asset examined (Redmond 4547222, Boathouse 3667783, Sandcastle 3667784, and CesiumJS 1.146's own test cube) is SPZ 3.
 * CesiumJS 1.146 decodes every such payload with `coordinateSystem: "UNSPECIFIED"` (`GltfSpzLoader.js`) and sorts by view depth.
 *
 * The adapter therefore applies only to SPZ 3 payloads in the draft layout, which it decodes as CesiumJS does. An SPZ 2 payload is
 * decoded as the draft text requires, even in the draft layout, so content written to the draft is not mistaken for ion's.
 *
 * Remove the adapter once Cesium ion serves content with `kernel`, `colorSpace` and LUF payloads, or CesiumJS decodes ion content in LUF.
 * @internal
 */
export function usesCesiumIonDraftAdapter(request: GaussianSplatSpzRequest, spzVersion: number): boolean {
  return request.draftLayout && spzVersion === 3;
}

/** @internal */
export type GaussianSplatDecodeRequest = GaussianSplatAttributesRequest | GaussianSplatSpzRequest;

/** The bytes of an SPZ request's input the worker holds while it decodes it: the payload and, at most, its decompressed body. */
function spzInputBytes(compressedBytes: number, count: number, shDegree: number): number {
  return compressedBytes + count * spzBodyBytesPerSplat(3, shDegree);
}

/** The bytes the worker holds of a request's input while it decodes it, as far as the main thread can tell. @internal */
export function gaussianSplatRequestInputBytes(request: GaussianSplatDecodeRequest): number {
  if (request.format === "attributes")
    return request.views.reduce((bytes, view) => bytes + view.byteLength, 0);

  return spzInputBytes(request.spz.byteLength, request.count, request.shDegree);
}

type Buffers = GltfDictionary<GltfBuffer & { resolvedBuffer?: Uint8Array }>;
type Views = GltfDictionary<GltfBufferViewProps & { resolvedBuffer?: Uint8Array }>;

interface SparseAccessorProps {
  count: number;
  indices: { bufferView: GltfId, byteOffset?: number, componentType: number };
  values: { bufferView: GltfId, byteOffset?: number };
}

function nonNegativeInteger(value: number | undefined, label: string): number {
  if (undefined === value || !Number.isSafeInteger(value) || value < 0)
    gaussianSplatError(`invalid ${label}`);

  return value;
}

/** The bytes of a buffer view, checked against its buffer. */
function viewBytes(id: GltfId, buffers: Buffers, views: Views): Uint8Array {
  const view = views[id];
  if (!view)
    gaussianSplatError("missing buffer view");

  const length = nonNegativeInteger(view.byteLength, "buffer view length");
  const offset = view.resolvedBuffer ? 0 : nonNegativeInteger(view.byteOffset ?? 0, "buffer view offset");
  const bytes = view.resolvedBuffer ?? buffers[view.buffer]?.resolvedBuffer;
  if (!bytes || offset + length > bytes.byteLength)
    gaussianSplatError("buffer view exceeds its buffer");

  return bytes.subarray(offset, offset + length);
}

/** The buffer views that the accessors of the splat attributes use, copied for the worker. */
class AccessorViews {
  public readonly copies: Uint8Array[] = [];
  private readonly _indices = new Map<GltfId, number>();

  public constructor(private readonly _buffers: Buffers, private readonly _views: Views) { }

  /** The ids of the buffer views `accessor` uses. */
  public static idsOf(accessor: GltfAccessor): GltfId[] {
    const sparse = accessor.sparse as SparseAccessorProps | undefined;
    const ids = [accessor.bufferView, sparse?.indices?.bufferView, sparse?.values?.bufferView];
    return ids.filter((id): id is GltfId => id !== undefined);
  }

  /** The total length of the buffer views with `ids`, each counted once. */
  public byteLength(ids: Iterable<GltfId>): number {
    let bytes = 0;
    for (const id of new Set(ids))
      bytes += nonNegativeInteger(this._views[id]?.byteLength, "buffer view length");

    return bytes;
  }

  /** `accessor`, with its buffer views copied for the worker. */
  public describe(accessor: GltfAccessor, components: number): GaussianSplatAccessor {
    const sparse = accessor.sparse as SparseAccessorProps | undefined;
    if (sparse && (!sparse.indices || !sparse.values))
      gaussianSplatError("invalid sparse accessor");

    return {
      count: nonNegativeInteger(accessor.count, "accessor count"),
      componentType: accessor.componentType ?? 0,
      normalized: true === accessor.normalized,
      components,
      elements: accessor.bufferView === undefined ? undefined : {
        view: this.copy(accessor.bufferView),
        byteOffset: nonNegativeInteger(accessor.byteOffset ?? 0, "accessor offset"),
        byteStride: this._views[accessor.bufferView]?.byteStride,
      },
      sparse: sparse && {
        count: nonNegativeInteger(sparse.count, "sparse count"),
        indices: { view: this.copy(sparse.indices.bufferView), byteOffset: nonNegativeInteger(sparse.indices.byteOffset ?? 0, "sparse indices offset"), componentType: sparse.indices.componentType },
        values: { view: this.copy(sparse.values.bufferView), byteOffset: nonNegativeInteger(sparse.values.byteOffset ?? 0, "sparse values offset") },
      },
    };
  }

  private copy(id: GltfId): number {
    let index = this._indices.get(id);
    if (undefined === index) {
      index = this.copies.length;
      this.copies.push(viewBytes(id, this._buffers, this._views).slice());
      this._indices.set(id, index);
    }

    return index;
  }
}

interface GaussianSplattingExtension {
  kernel?: string;
  colorSpace?: string;
  projection?: string;
  sortingMethod?: string;
  extensions?: { [name: string]: { bufferView: GltfId } | undefined };
}

const attributePrefix = "KHR_gaussian_splatting:";

interface AttributeLayout {
  components: number;
  types: number[];
  /** Integer components must be normalized. */
  normalizedIntegers?: boolean;
}

const dataType = GltfDataType;
/** The components per element and the component types allowed for each splat attribute. */
const attributeLayouts = {
  positions: { components: 3, types: [dataType.SignedByte, dataType.UnsignedByte, dataType.SignedShort, dataType.UnsignedShort, dataType.Float] },
  rotations: { components: 4, types: [dataType.SignedByte, dataType.SignedShort, dataType.Float], normalizedIntegers: true },
  scales: { components: 3, types: [dataType.UnsignedByte, dataType.UnsignedShort, dataType.Float] },
  opacities: { components: 1, types: [dataType.UnsignedByte, dataType.UnsignedShort, dataType.Float], normalizedIntegers: true },
  sh: { components: 3, types: [dataType.Float] },
} satisfies { [attribute: string]: AttributeLayout };

/** The highest SH degree for which the primitive has attributes. */
function declaredShDegree(attributeNames: string[]): number {
  const hasShDegree = (degree: number) => attributeNames.some((name) => name.startsWith(`${attributePrefix}SH_DEGREE_${degree}_`));
  return [3, 2, 1].find(hasShDegree) ?? 0;
}

/** Validate the supported extension profile and extract data to transfer to the decoder worker. The tile's splat count and memory
 * limits are checked before anything is copied.
 * @internal
 */
export function readGaussianSplatSource(primitive: GltfMeshPrimitive, document: GltfDocument, buffers: Buffers, views: Views): GaussianSplatDecodeRequest {
  const extension = primitive.extensions?.KHR_gaussian_splatting as GaussianSplattingExtension | undefined;
  if (!extension || primitive.mode !== GltfMeshMode.Points || primitive.indices !== undefined || primitive.targets
    || primitive.extensions?.KHR_spz_gaussian_splats_compression)
    gaussianSplatError("expected an unindexed POINTS primitive with KHR_gaussian_splatting");

  const compression = extension.extensions?.KHR_gaussian_splatting_compression_spz_2;
  // Compressed content in the draft layout implies the only kernel and the display color space (see usesCesiumIonDraftAdapter).
  const draftLayout = !!compression && extension.kernel === undefined && extension.colorSpace === undefined
    && primitive.attributes.COLOR_0 !== undefined && primitive.attributes[`${attributePrefix}SH_DEGREE_0_COEF_0`] === undefined;
  const kernel = extension.kernel ?? (draftLayout ? "ellipse" : undefined);
  const colorSpace = extension.colorSpace ?? (draftLayout ? "srgb_rec709_display" : undefined);
  if (kernel !== "ellipse" || !["srgb_rec709_display", "lin_rec709_display"].includes(colorSpace ?? "")
    || (extension.projection !== undefined && extension.projection !== "perspective")
    || (extension.sortingMethod !== undefined && extension.sortingMethod !== "cameraDistance"))
    gaussianSplatError("unsupported kernel, color space, projection or sorting method");

  const supportedColorSpace = colorSpace as GaussianSplatData["colorSpace"];
  const accessors = document.accessors ?? {};
  const positionId = primitive.attributes.POSITION;
  const count = positionId !== undefined ? accessors[positionId]?.count : undefined;
  if (count === undefined)
    gaussianSplatError("missing POSITION");

  const shDegree = declaredShDegree(Object.keys(primitive.attributes));
  if (!compression)
    return readAttributesRequest(primitive, accessors, new AccessorViews(buffers, views), { count, shDegree, colorSpace: supportedColorSpace });

  for (const id of Object.values(primitive.attributes))
    if (id === undefined || accessors[id]?.count !== count)
      gaussianSplatError("compressed accessor counts must match POSITION");

  const spz = viewBytes(compression.bufferView, buffers, views);
  checkGaussianSplatDecodeLimits(count, shDegree, spzInputBytes(spz.byteLength, count, shDegree));
  return {
    format: "spz",
    spz: spz.slice(),
    count,
    shDegree,
    colorSpace: supportedColorSpace,
    draftLayout,
  };
}

/** The request for uncompressed attributes, whose buffer views are copied once their accessors are valid and within the limits. */
function readAttributesRequest(primitive: GltfMeshPrimitive, accessors: GltfDictionary<GltfAccessor>, copies: AccessorViews,
  tile: { count: number, shDegree: number, colorSpace: GaussianSplatData["colorSpace"] }): GaussianSplatAttributesRequest {
  const shNames: string[] = [];
  for (let degree = 0; degree <= tile.shDegree; degree++)
    for (let coefficientInBand = 0; coefficientInBand < 2 * degree + 1; coefficientInBand++)
      shNames.push(`${attributePrefix}SH_DEGREE_${degree}_COEF_${coefficientInBand}`);

  const numShAttributes = Object.keys(primitive.attributes).filter((name) => name.startsWith(`${attributePrefix}SH_`)).length;
  if (numShAttributes !== shNames.length)
    gaussianSplatError("incomplete or unsupported spherical harmonics");

  const validAccessor = (name: string, layout: AttributeLayout) => {
    const id = primitive.attributes[name];
    const accessor = id !== undefined ? accessors[id] : undefined;
    const type = accessor?.componentType ?? 0;
    const shape = layout.components === 1 ? "SCALAR" : `VEC${layout.components}`;
    if (!accessor || accessor.count !== tile.count || accessor.type !== shape || !layout.types.includes(type))
      gaussianSplatError(`missing or invalid ${name}`);

    if (layout.normalizedIntegers && type !== dataType.Float && !accessor.normalized)
      gaussianSplatError(`${name} integer values must be normalized`);

    return accessor;
  };

  const positions = validAccessor("POSITION", attributeLayouts.positions);
  const rotations = validAccessor(`${attributePrefix}ROTATION`, attributeLayouts.rotations);
  const scales = validAccessor(`${attributePrefix}SCALE`, attributeLayouts.scales);
  const opacities = validAccessor(`${attributePrefix}OPACITY`, attributeLayouts.opacities);
  const sh = shNames.map((name) => validAccessor(name, attributeLayouts.sh));

  const viewIds = [positions, rotations, scales, opacities, ...sh].flatMap((accessor) => AccessorViews.idsOf(accessor));
  checkGaussianSplatDecodeLimits(tile.count, tile.shDegree, copies.byteLength(viewIds));

  const described = {
    positions: copies.describe(positions, attributeLayouts.positions.components),
    rotations: copies.describe(rotations, attributeLayouts.rotations.components),
    scales: copies.describe(scales, attributeLayouts.scales.components),
    opacities: copies.describe(opacities, attributeLayouts.opacities.components),
    sh: sh.map((accessor) => copies.describe(accessor, attributeLayouts.sh.components)),
  };

  return { format: "attributes", ...tile, ...described, views: copies.copies };
}
