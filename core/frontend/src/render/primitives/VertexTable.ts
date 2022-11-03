/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { Point2d, Point3d, Range2d } from "@itwin/core-geometry";
import {
  ColorDef, ColorIndex, FeatureIndex, FeatureIndexType, QParams2d, QParams3d, QPoint2d, QPoint3dList,
} from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { AuxChannelTable } from "./AuxChannelTable";
import { MeshArgs, Point3dList, PolylineArgs } from "./mesh/MeshPrimitives";
import { createSurfaceMaterial, SurfaceMaterial, SurfaceParams, SurfaceType } from "./SurfaceParams";
import { EdgeParams } from "./EdgeParams";

/**
 * Holds an array of indices into a VertexTable. Each index is a 24-bit unsigned integer.
 * The order of the indices specifies the order in which vertices are drawn.
 * @internal
 */
export class VertexIndices implements Iterable<number> {
  public readonly data: Uint8Array;

  /**
   * Directly construct from an array of bytes in which each index occupies 3 contiguous bytes.
   * The length of the array must be a multiple of 3. This object takes ownership of the array.
   */
  public constructor(data: Uint8Array) {
    this.data = data;
    assert(0 === this.data.length % 3);
  }

  /** Get the number of 24-bit indices. */
  public get length(): number { return this.data.length / 3; }

  /** Convert an array of 24-bit unsigned integer values into a VertexIndices object. */
  public static fromArray(indices: number[]): VertexIndices {
    const bytes = new Uint8Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++)
      this.encodeIndex(indices[i], bytes, i * 3);

    return new VertexIndices(bytes);
  }

  public static encodeIndex(index: number, bytes: Uint8Array, byteIndex: number): void {
    assert(byteIndex + 2 < bytes.length);
    bytes[byteIndex + 0] = index & 0x000000ff;
    bytes[byteIndex + 1] = (index & 0x0000ff00) >> 8;
    bytes[byteIndex + 2] = (index & 0x00ff0000) >> 16;
  }

  public setNthIndex(n: number, value: number): void {
    VertexIndices.encodeIndex(value, this.data, n * 3);
  }

  public decodeIndex(index: number): number {
    assert(index < this.length);
    const byteIndex = index * 3;
    return this.data[byteIndex] | (this.data[byteIndex + 1] << 8) | (this.data[byteIndex + 2] << 16);
  }

  public decodeIndices(): number[] {
    const indices = [];
    for (let i = 0; i < this.length; i++)
      indices.push(this.decodeIndex(i));

    return indices;
  }

  public [Symbol.iterator]() {
    function * iterator(indices: VertexIndices) {
      for (let i = 0; i < indices.length; i++)
        yield indices.decodeIndex(i);
    }

    return iterator(this);
  }
}

/** @internal */
export interface Dimensions {
  width: number;
  height: number;
}

/** @internal */
export function computeDimensions(nEntries: number, nRgbaPerEntry: number, nExtraRgba: number, maxSize?: number): Dimensions {
  maxSize = maxSize ?? IModelApp.renderSystem.maxTextureSize;
  const nRgba = nEntries * nRgbaPerEntry + nExtraRgba;

  if (nRgba < maxSize)
    return { width: nRgba, height: 1 };

  // Make roughly square to reduce unused space in last row
  let width = Math.ceil(Math.sqrt(nRgba));

  // Ensure a given entry's RGBA values all fit on the same row.
  const remainder = width % nRgbaPerEntry;
  if (0 !== remainder) {
    width += nRgbaPerEntry - remainder;
  }

  // Compute height
  let height = Math.ceil(nRgba / width);
  if (width * height < nRgba)
    ++height;

  assert(height <= maxSize);
  assert(width <= maxSize);
  assert(width * height >= nRgba);
  assert(Math.floor(height) === height);
  assert(Math.floor(width) === width);

  // Row padding should never be necessary...
  assert(0 === width % nRgbaPerEntry);

  return { width, height };
}

/** Describes a VertexTable.
 * @internal
 */
export interface VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  readonly data: Uint8Array;
  /** If true, positions are not quantized but instead stored as 32-bit floats.
   * [[qparams]] will still be defined; it can be used to derive the range of positions in the table.
   */
  readonly usesUnquantizedPositions?: boolean;
  /** Quantization parameters for the vertex positions encoded into the array, if the positions are quantized;
   * and for deriving the range of positions in the table, whether quantized or not.
   */
  readonly qparams: QParams3d;
  /** The number of 4-byte 'RGBA' values in each row of the array. Must be divisible by numRgbaPerVertex. */
  readonly width: number;
  /** The number of rows in the array. */
  readonly height: number;
  /** Whether or not the vertex colors contain translucent colors. */
  readonly hasTranslucency: boolean;
  /** If no color table exists, the color to use for all vertices. */
  readonly uniformColor?: ColorDef;
  /** Describes the number of features (none, one, or multiple) contained. */
  readonly featureIndexType: FeatureIndexType;
  /** If featureIndexType is 'Uniform', the feature ID associated with all vertices. */
  readonly uniformFeatureID?: number;
  /** The number of vertices in the table. Must be less than (width*height)/numRgbaPerVertex. */
  readonly numVertices: number;
  /** The number of 4-byte 'RGBA' values associated with each vertex. */
  readonly numRgbaPerVertex: number;
  /** If vertex data include texture UV coordinates, the quantization params for those coordinates. */
  readonly uvParams?: QParams2d;
}

/**
 * Represents vertex data (position, color, normal, UV params, etc) in a rectangular array.
 * Each vertex is described by one or more contiguous 4-byte ('RGBA') values.
 * This allows vertex data to be uploaded to the GPU as a texture and vertex data to be sampled
 * from that texture using a single vertex ID representing an index into the array.
 * Vertex color is identified by a 16-bit index into a color table appended to the vertex data.
 * @internal
 */
export class VertexTable implements VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  public readonly data: Uint8Array;
  /** If true, positions are not quantized but instead stored as 32-bit floats.
   * [[qparams]] will still be defined; it can be used to derive the range of positions in the table.
   */
  public readonly usesUnquantizedPositions?: boolean;
  /** Quantization parameters for the vertex positions encoded into the array, the positions are quantized;
   * and for deriving the range of positions in the table, whether quantized or not.
   */
  public readonly qparams: QParams3d;
  /** The number of 4-byte 'RGBA' values in each row of the array. Must be divisible by numRgbaPerVertex. */
  public readonly width: number;
  /** The number of rows in the array. */
  public readonly height: number;
  /** Whether or not the vertex colors contain translucent colors. */
  public readonly hasTranslucency: boolean;
  /** If no color table exists, the color to use for all vertices. */
  public readonly uniformColor?: ColorDef;
  /** Describes the number of features (none, one, or multiple) contained. */
  public readonly featureIndexType: FeatureIndexType;
  /** If featureIndexType is 'Uniform', the feature ID associated with all vertices. */
  public readonly uniformFeatureID?: number;
  /** The number of vertices in the table. Must be less than (width*height)/numRgbaPerVertex. */
  public readonly numVertices: number;
  /** The number of 4-byte 'RGBA' values associated with each vertex. */
  public readonly numRgbaPerVertex: number;
  /** If vertex data include texture UV coordinates, the quantization params for those coordinates. */
  public readonly uvParams?: QParams2d;

  /** Construct a VertexTable. The VertexTable takes ownership of all input data - it must not be later modified by the caller. */
  public constructor(props: VertexTableProps) {
    this.data = props.data;
    this.qparams = props.qparams;
    this.usesUnquantizedPositions = !!props.usesUnquantizedPositions;
    this.width = props.width;
    this.height = props.height;
    this.hasTranslucency = true === props.hasTranslucency;
    this.uniformColor = props.uniformColor;
    this.featureIndexType = props.featureIndexType;
    this.uniformFeatureID = props.uniformFeatureID;
    this.numVertices = props.numVertices;
    this.numRgbaPerVertex = props.numRgbaPerVertex;
    this.uvParams = props.uvParams;
  }

  public static buildFrom(builder: VertexTableBuilder, colorIndex: ColorIndex, featureIndex: FeatureIndex): VertexTable {
    const { numVertices, numRgbaPerVertex } = builder;
    const numColors = colorIndex.isUniform ? 0 : colorIndex.numColors;
    const dimensions = computeDimensions(numVertices, numRgbaPerVertex, numColors);
    assert(0 === dimensions.width % numRgbaPerVertex || (0 < numColors && 1 === dimensions.height));

    const data = new Uint8Array(dimensions.width * dimensions.height * 4);

    builder.data = data;
    for (let i = 0; i < numVertices; i++)
      builder.appendVertex(i);

    builder.appendColorTable(colorIndex);

    builder.data = undefined;

    return new VertexTable({
      data,
      qparams: builder.qparams,
      usesUnquantizedPositions: builder.usesUnquantizedPositions,
      width: dimensions.width,
      height: dimensions.height,
      hasTranslucency: colorIndex.hasAlpha,
      uniformColor: colorIndex.uniform,
      numVertices,
      numRgbaPerVertex,
      uvParams: builder.uvParams,
      featureIndexType: featureIndex.type,
      uniformFeatureID: featureIndex.type === FeatureIndexType.Uniform ? featureIndex.featureID : undefined,
    });
  }

  public static createForPolylines(args: PolylineArgs): VertexTable | undefined {
    const polylines = args.polylines;
    if (0 < polylines.length)
      return this.buildFrom(createPolylineBuilder(args), args.colors, args.features);
    else
      return undefined;
  }
}

/** @internal */
export interface VertexTableWithIndices {
  vertices: VertexTable;
  indices: VertexIndices;
  material?: SurfaceMaterial;
}

/**
 * Describes mesh geometry to be submitted to the rendering system.
 * A mesh consists of a surface and its edges, which may include any combination of silhouettes, polylines, and single segments.
 * The surface and edges all refer to the same vertex table.
 */
export class MeshParams {
  public readonly vertices: VertexTable;
  public readonly surface: SurfaceParams;
  public edges?: EdgeParams;
  public readonly isPlanar: boolean;
  public readonly auxChannels?: AuxChannelTable;

  /** Directly construct a MeshParams. The MeshParams takes ownership of all input data. */
  public constructor(vertices: VertexTable, surface: SurfaceParams, edges?: EdgeParams, isPlanar?: boolean, auxChannels?: AuxChannelTable) {
    this.vertices = vertices;
    this.surface = surface;
    this.edges = edges;
    this.isPlanar = !!isPlanar;
    this.auxChannels = auxChannels;
  }

  /** Construct from a MeshArgs. */
  public static create(args: MeshArgs): MeshParams {
    const builder = createMeshBuilder(args);
    const vertices = VertexTable.buildFrom(builder, args.colors, args.features);

    const surfaceIndices = VertexIndices.fromArray(args.vertIndices);

    const surface: SurfaceParams = {
      type: builder.type,
      indices: surfaceIndices,
      fillFlags: args.fillFlags,
      hasBakedLighting: true === args.hasBakedLighting,
      textureMapping: undefined !== args.textureMapping ? { texture: args.textureMapping.texture, alwaysDisplayed: false } : undefined,
      material: createSurfaceMaterial(args.material),
    };

    const channels = undefined !== args.auxChannels ? AuxChannelTable.fromChannels(args.auxChannels, vertices.numVertices) : undefined;
    const edges = EdgeParams.fromMeshArgs(args);
    return new MeshParams(vertices, surface, edges, args.isPlanar, channels);
  }
}

/** Builds a VertexTable from some data type supplying the vertex data. */
export abstract class VertexTableBuilder {
  public data?: Uint8Array;
  private _curIndex: number = 0;

  public abstract get numVertices(): number;
  public abstract get numRgbaPerVertex(): number;
  public abstract get qparams(): QParams3d;
  public abstract get usesUnquantizedPositions(): boolean;
  public get uvParams(): QParams2d | undefined { return undefined; }
  public abstract appendVertex(vertIndex: number): void;

  public appendColorTable(colorIndex: ColorIndex) {
    if (undefined !== colorIndex.nonUniform) {
      for (const color of colorIndex.nonUniform.colors) {
        this.appendColor(color);
      }
    }
  }

  protected advance(nBytes: number) {
    this._curIndex += nBytes;
    assert(this._curIndex <= this.data!.length);
  }

  protected append8(val: number) {
    assert(0 <= val);
    assert(val <= 0xff);
    assert(val === Math.floor(val));

    this.data![this._curIndex] = val;
    this.advance(1);
  }
  protected append16(val: number) {
    this.append8(val & 0x00ff);
    this.append8(val >>> 8);
  }
  protected append32(val: number) {
    this.append16(val & 0x0000ffff);
    this.append16(val >>> 16);
  }

  private appendColor(tbgr: number) {
    const colors = ColorDef.getColors(tbgr);

    // invert transparency => alpha
    colors.t = 255 - colors.t;

    // premultiply alpha...
    switch (colors.t) {
      case 0:
        colors.r = colors.g = colors.b = 0;
        break;
      case 255:
        break;
      default: {
        const f = colors.t / 255.0;
        colors.r = Math.floor(colors.r * f + 0.5);
        colors.g = Math.floor(colors.g * f + 0.5);
        colors.b = Math.floor(colors.b * f + 0.5);
        break;
      }
    }

    // Store 32-bit value in little-endian order (red first)
    this.append8(colors.r);
    this.append8(colors.g);
    this.append8(colors.b);
    this.append8(colors.t);
  }
}

type VertexData = PolylineArgs | MeshArgs;
type Quantized<T extends VertexData> = Omit<T, "points"> & { points: QPoint3dList };
type Unquantized<T extends VertexData> = Omit<T, "points"> & { points: Omit<Point3dList, "add"> };

namespace Quantized { // eslint-disable-line @typescript-eslint/no-redeclare
  /**
   * Supplies vertex data from a PolylineArgs or MeshArgs. Each vertex consists of 12 bytes:
   *  pos.x           00
   *  pos.y           02
   *  pos.z           04
   *  colorIndex      06
   *  featureIndex    08 (24 bits)
   *  materialIndex   0B (for meshes that use a material atlas; otherwise unused). NOTE: Currently front-end code does not produce material atlases.
   */
  export class SimpleBuilder<T extends Quantized<VertexData>> extends VertexTableBuilder {
    public args: T;
    protected _qpoints: QPoint3dList;

    public constructor(args: T) {
      super();
      this._qpoints = args.points;
      this.args = args;
      assert(undefined !== this.args.points);
    }

    public get numVertices() { return this.args.points.length; }
    public get numRgbaPerVertex() { return 3; }
    public get usesUnquantizedPositions() { return false; }
    public get qparams() {
      return this._qpoints.params;
    }

    public appendVertex(vertIndex: number): void {
      this.appendPosition(vertIndex);
      this.appendColorIndex(vertIndex);
      this.appendFeatureIndex(vertIndex);
    }

    protected appendPosition(vertIndex: number) {
      this.append16(this._qpoints.list[vertIndex].x);
      this.append16(this._qpoints.list[vertIndex].y);
      this.append16(this._qpoints.list[vertIndex].z);
    }

    protected appendColorIndex(vertIndex: number) {
      if (undefined !== this.args.colors.nonUniform) {
        this.append16(this.args.colors.nonUniform.indices[vertIndex]);
      } else {
        this.advance(2);
      }
    }

    protected appendFeatureIndex(vertIndex: number) {
      if (undefined !== this.args.features.featureIDs) {
        this.append32(this.args.features.featureIDs[vertIndex]);
      } else {
        this.advance(4);
      }
    }
  }

  /** Supplies vertex data from a MeshArgs. */
  export class MeshBuilder extends SimpleBuilder<Quantized<MeshArgs>> {
    public readonly type: SurfaceType;

    protected constructor(args: Quantized<MeshArgs>, type: SurfaceType) {
      super(args);
      this.type = type;
    }

    public static create(args: Quantized<MeshArgs>): MeshBuilder {
      if (args.isVolumeClassifier)
        return new MeshBuilder(args, SurfaceType.VolumeClassifier);

      const isLit = undefined !== args.normals && 0 < args.normals.length;
      const isTextured = undefined !== args.textureMapping;

      let uvParams: QParams2d | undefined;

      if (args.textureMapping) {
        const uvRange = Range2d.createNull();
        const fpts = args.textureMapping.uvParams;
        const pt2d = new Point2d();
        if (undefined !== fpts && fpts.length > 0)
          for (let i = 0; i < args.points.length; i++)
            uvRange.extendPoint(Point2d.create(fpts[i].x, fpts[i].y, pt2d));

        uvParams = QParams2d.fromRange(uvRange);
      }

      if (isLit)
        return isTextured ? new TexturedLitMeshBuilder(args, uvParams!) : new LitMeshBuilder(args);
      else
        return isTextured ? new TexturedMeshBuilder(args, uvParams!) : new MeshBuilder(args, SurfaceType.Unlit);
    }
  }

  /** Supplies vertex data from a MeshArgs where each vertex consists of 16 bytes.
   * In addition to the SimpleBuilder data, the final 4 bytes hold the quantized UV params
   * The color index is left uninitialized as it is unused.
   */
  class TexturedMeshBuilder extends MeshBuilder {
    private _qparams: QParams2d;
    private _qpoint = new QPoint2d();

    public constructor(args: Quantized<MeshArgs>, qparams: QParams2d, type: SurfaceType = SurfaceType.Textured) {
      super(args, type);
      this._qparams = qparams;
      assert(undefined !== args.textureMapping);
    }

    public override get numRgbaPerVertex() { return 4; }
    public override get uvParams() { return this._qparams; }

    public override appendVertex(vertIndex: number) {
      this.appendPosition(vertIndex);
      this.appendNormal(vertIndex);
      this.appendFeatureIndex(vertIndex);
      this.appendUVParams(vertIndex);
    }

    protected appendNormal(_vertIndex: number): void { this.advance(2); } // no normal for unlit meshes

    protected appendUVParams(vertIndex: number) {
      this._qpoint.init(this.args.textureMapping!.uvParams[vertIndex], this._qparams);
      this.append16(this._qpoint.x);
      this.append16(this._qpoint.y);
    }
  }

  /** As with TexturedMeshBuilder, but the color index is replaced with the oct-encoded normal value. */
  class TexturedLitMeshBuilder extends TexturedMeshBuilder {
    public constructor(args: Quantized<MeshArgs>, qparams: QParams2d) {
      super(args, qparams, SurfaceType.TexturedLit);
      assert(undefined !== args.normals);
    }

    protected override appendNormal(vertIndex: number) { this.append16(this.args.normals![vertIndex].value); }
  }

  /** 16 bytes. The last 2 bytes are unused; the 2 immediately preceding it hold the oct-encoded normal value. */
  class LitMeshBuilder extends MeshBuilder {
    public constructor(args: Quantized<MeshArgs>) {
      super(args, SurfaceType.Lit);
      assert(undefined !== args.normals);
    }

    public override get numRgbaPerVertex() { return 4; }

    public override appendVertex(vertIndex: number) {
      super.appendVertex(vertIndex);
      this.append16(this.args.normals![vertIndex].value);
      this.advance(2); // 2 unused bytes
    }
  }
}

/** Builders in this namespace store vertex positions as 32-bit floats instead of quantizing to 16-bit unsigned integers.
 * This is preferred for decoration graphics, which might contain ranges of positions that exceed the limits for quantization; if quantized,
 * they could produce visual artifacts.
 * Each builder produces a VertexTable that starts with the following layout:
 *  pos.x:        00
 *  pos.y:        04
 *  pos.z:        08
 *  featureIndex: 0C
 *  materialIndex:0F (NOTE: frontend code currently doesn't produce material atlases, so this is always zero).
 * Followed (by default) by:
 *  colorIndex:   10
 *  unused:       12
 * Subclasses may add 4 more bytes and/or overwrite the final 4 bytes above.
 */
namespace Unquantized { // eslint-disable-line @typescript-eslint/no-redeclare
  const u32Array = new Uint32Array(1);
  const f32Array = new Float32Array(u32Array.buffer);

  // colorIndex:  10
  // unused:      12
  export class SimpleBuilder<T extends Unquantized<VertexData>> extends VertexTableBuilder {
    public args: T;
    protected _points: Point3d[];
    private _qparams3d: QParams3d;

    public constructor(args: T) {
      super();
      assert(!(args.points instanceof QPoint3dList));
      this._qparams3d = QParams3d.fromRange(args.points.range);
      this.args = args;
      this._points = args.points;
    }

    public get numVertices() { return this._points.length; }
    public get numRgbaPerVertex() { return 5; }
    public get usesUnquantizedPositions() { return true; }
    public get qparams() { return this._qparams3d; }

    public appendVertex(vertIndex: number): void {
      this.appendTransposePosAndFeatureNdx(vertIndex);
      this.appendColorIndex(vertIndex);
    }

    private appendFloat32(val: number) {
      f32Array[0] = val;
      this.append32(u32Array[0]);
    }

    private convertFloat32(val: number): number {
      f32Array[0] = val;
      return u32Array[0];
    }

    protected appendTransposePosAndFeatureNdx(vertIndex: number) {
      // transpose position xyz vals into [0].xyz - [3].xyz, and add feature index at .w
      // this is to order things to let shader code access much more efficiently
      const pt = this._points[vertIndex];
      const x = this.convertFloat32 (pt.x);
      const y = this.convertFloat32 (pt.y);
      const z = this.convertFloat32 (pt.z);
      const featID = (this.args.features.featureIDs) ? this.args.features.featureIDs[vertIndex] : 0;
      this.append8(x & 0x000000ff);
      this.append8(y & 0x000000ff);
      this.append8(z & 0x000000ff);
      this.append8(featID & 0x000000ff);
      this.append8((x >>> 8) & 0x000000ff);
      this.append8((y >>> 8) & 0x000000ff);
      this.append8((z >>> 8) & 0x000000ff);
      this.append8((featID >>> 8) & 0x000000ff);
      this.append8((x >>> 16) & 0x000000ff);
      this.append8((y >>> 16) & 0x000000ff);
      this.append8((z >>> 16) & 0x000000ff);
      this.append8((featID >>> 16) & 0x000000ff);
      this.append8(x >>> 24);
      this.append8(y >>> 24);
      this.append8(z >>> 24);
      this.append8(featID >>> 24);
    }

    protected appendPosition(vertIndex: number) {
      const pt = this._points[vertIndex];
      this.appendFloat32(pt.x);
      this.appendFloat32(pt.y);
      this.appendFloat32(pt.z);
    }

    protected appendFeatureIndex(vertIndex: number) {
      if (this.args.features.featureIDs)
        this.append32(this.args.features.featureIDs[vertIndex]);
      else
        this.advance(4);
    }

    protected _appendColorIndex(vertIndex: number) {
      if (undefined !== this.args.colors.nonUniform)
        this.append16(this.args.colors.nonUniform.indices[vertIndex]);
      else
        this.advance(2);
    }

    protected appendColorIndex(vertIndex: number) {
      this._appendColorIndex(vertIndex);
      this.advance(2);
    }
  }

  export class MeshBuilder extends SimpleBuilder<Unquantized<MeshArgs>> {
    public readonly type: SurfaceType;

    protected constructor(args: Unquantized<MeshArgs>, type: SurfaceType) {
      super(args);
      this.type = type;
    }

    public static create(args: Unquantized<MeshArgs>): MeshBuilder {
      if (args.isVolumeClassifier)
        return new MeshBuilder(args, SurfaceType.VolumeClassifier);

      const isLit = undefined !== args.normals && 0 < args.normals.length;
      const isTextured = undefined !== args.textureMapping;

      let uvParams: QParams2d | undefined;

      if (args.textureMapping) {
        const uvRange = Range2d.createNull();
        const fpts = args.textureMapping.uvParams;
        const pt2d = new Point2d();
        if (undefined !== fpts && fpts.length > 0)
          for (let i = 0; i < args.points.length; i++)
            uvRange.extendPoint(Point2d.create(fpts[i].x, fpts[i].y, pt2d));

        uvParams = QParams2d.fromRange(uvRange);
      }

      if (isLit)
        return isTextured ? new TexturedLitMeshBuilder(args, uvParams!) : new LitMeshBuilder(args);
      else
        return isTextured ? new TexturedMeshBuilder(args, uvParams!) : new MeshBuilder(args, SurfaceType.Unlit);
    }
  }

  // u: 10
  // v: 12
  class TexturedMeshBuilder extends MeshBuilder {
    private _qparams: QParams2d;
    private _qpoint = new QPoint2d();

    public constructor(args: Unquantized<MeshArgs>, qparams: QParams2d, type = SurfaceType.Textured) {
      super(args, type);
      this._qparams = qparams;
      assert(undefined !== args.textureMapping);
    }

    public override get uvParams() { return this._qparams; }

    public override appendVertex(vertIndex: number) {
      super.appendVertex(vertIndex);

      this._qpoint.init(this.args.textureMapping!.uvParams[vertIndex], this._qparams);
      this.append16(this._qpoint.x);
      this.append16(this._qpoint.y);
    }

    protected override appendColorIndex() { }
  }

  // u: 10
  // v: 12
  // normal: 14
  // unused: 16
  class TexturedLitMeshBuilder extends TexturedMeshBuilder {
    public constructor(args: Unquantized<MeshArgs>, qparams: QParams2d) {
      super(args, qparams, SurfaceType.TexturedLit);
      assert(undefined !== args.normals);
    }

    public override get numRgbaPerVertex() { return 6; }

    public override appendVertex(vertIndex: number) {
      super.appendVertex(vertIndex);
      this.append16(this.args.normals![vertIndex].value);
      this.advance(2);
    }
  }

  // color: 10
  // normal: 12
  class LitMeshBuilder extends MeshBuilder {
    public constructor(args: Unquantized<MeshArgs>) {
      super(args, SurfaceType.Lit);
      assert(undefined !== args.normals);
    }

    protected override appendColorIndex(vertIndex: number) {
      super._appendColorIndex(vertIndex);
    }

    public override appendVertex(vertIndex: number) {
      super.appendVertex(vertIndex);
      this.append16(this.args.normals![vertIndex].value);
    }
  }
}

function createMeshBuilder(args: MeshArgs): VertexTableBuilder & { type: SurfaceType } {
  if (args.points instanceof QPoint3dList)
    return Quantized.MeshBuilder.create(args as Quantized<MeshArgs>);
  else
    return Unquantized.MeshBuilder.create(args as Unquantized<MeshArgs>);
}

function createPolylineBuilder(args: PolylineArgs): VertexTableBuilder {
  if (args.points instanceof QPoint3dList)
    return new Quantized.SimpleBuilder(args as Quantized<PolylineArgs>);
  else
    return new Unquantized.SimpleBuilder(args as Unquantized<PolylineArgs>);
}
