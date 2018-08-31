/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { assert } from "@bentley/bentleyjs-core";
import { Range2d, Point2d } from "@bentley/geometry-core";
import { ColorDef, ColorIndex, FeatureIndex, QPoint2d, QParams2d, QParams3d, FeatureIndexType } from "@bentley/imodeljs-common";
import { PolylineArgs, MeshArgs } from "./mesh/MeshPrimitives";
import { IModelApp } from "../../IModelApp";

/**
 * Holds an array of indices into a VertexTable. Each index is a 24-bit unsigned integer.
 * The order of the indices specifies the order in which vertices are drawn.
 */
export class VertexIndices {
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
  public get length(): number { return this.data.length % 3; }

  /** Convert an array of 24-bit unsigned integer values into a VertexIndices object. */
  public static fromArray(indices: number[]): VertexIndices {
    const bytes = new Uint8Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const j = i * 3;
      bytes[j + 0] = index & 0x000000ff;
      bytes[j + 1] = (index & 0x0000ff00) >> 8;
      bytes[j + 2] = (index & 0x00ff0000) >> 16;
    }

    return new VertexIndices(bytes);
  }
}

interface Dimensions {
  width: number;
  height: number;
}

function computeDimensions(nEntries: number, nRgbaPerEntry: number, nExtraRgba: number): Dimensions {
  const maxSize = IModelApp.renderSystem.maxTextureSize;
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
  const height = Math.ceil(nRgba / width);

  assert(height <= maxSize);
  assert(width <= maxSize);
  assert(width * height >= nRgba);
  assert(Math.floor(height) === height);
  assert(Math.floor(width) === width);

  // Row padding should never be necessary...
  assert(0 === width % nRgbaPerEntry);

  return { width, height };
}

const scratchColorDef = new ColorDef();

export interface VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  readonly data: Uint8Array;
  /** Quantization parameters for the vertex positions encoded into the array. */
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
 */
export class VertexTable implements VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  public readonly data: Uint8Array;
  /** Quantization parameters for the vertex positions encoded into the array. */
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

  private static buildFrom(builder: VertexTableBuilder, colorIndex: ColorIndex, featureIndex: FeatureIndex): VertexTable {
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

  /** Create a VertexTable from a triangle mesh. */
  public static createForMesh(args: MeshArgs): VertexTable {
    const isLit = undefined !== args.normals && 0 < args.normals.length;
    const isTextured = undefined !== args.texture;

    let builder: VertexTableBuilder;
    let uvParams: QParams2d | undefined;

    if (isTextured) {
      const uvRange = Range2d.createNull();
      const fpts = args.textureUv;
      const pt2d = new Point2d();
      if (undefined !== fpts && fpts.length > 0)
        for (let i = 0; i < args.points!.length; i++)
          uvRange.extendPoint(Point2d.create(fpts[i].x, fpts[i].y, pt2d));

      uvParams = QParams2d.fromRange(uvRange);
    }

    if (isLit && isTextured)
      builder = new TexturedLitMeshBuilder(args, uvParams!);
    else if (isLit)
      builder = new LitMeshBuilder(args);
    else if (isTextured)
      builder = new TexturedMeshBuilder(args, uvParams!);
    else
      builder = new MeshBuilder(args);

    return this.buildFrom(builder, args.colors, args.features);
  }

  public static createForPolylines(args: PolylineArgs): VertexTable | undefined {
    const polylines = args.polylines;
    if (0 < polylines.length)
      return this.buildFrom(new SimpleBuilder(args), args.colors, args.features);
    else
      return undefined;
  }
}

/** Describes point string geometry to be submitted to the rendering system. */
export class PointStringParams {
  public readonly vertices: VertexTable;
  public readonly indices: VertexIndices;
  public readonly weight: number;

  public constructor(vertices: VertexTable, indices: VertexIndices, weight: number) {
    this.vertices = vertices;
    this.indices = indices;
    this.weight = weight;
  }

  public static create(args: PolylineArgs): PointStringParams | undefined {
    if (!args.flags.isDisjoint)
      return undefined;

    const vertices = VertexTable.createForPolylines(args);
    if (undefined === vertices)
      return undefined;

    const polylines = args.polylines;
    let vertIndices = polylines[0].vertIndices;
    if (1 < polylines.length) {
      // We used to assert this wouldn't happen - apparently it does...
      vertIndices = [];
      for (const polyline of polylines)
        for (const vertIndex of polyline.vertIndices)
          vertIndices.push(vertIndex);
    }

    const vertexIndices = VertexIndices.fromArray(vertIndices);
    assert(vertexIndices.length === vertIndices.length * 3);

    return new PointStringParams(vertices, vertexIndices, args.width);
  }
}

/** Builds a VertexTable from some data type supplying the vertex data. */
abstract class VertexTableBuilder {
  public data?: Uint8Array;
  private _curIndex: number = 0;

  public abstract get numVertices(): number;
  public abstract get numRgbaPerVertex(): number;
  public abstract get qparams(): QParams3d;
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
    const colorDef = scratchColorDef;
    colorDef.tbgr = tbgr;
    const colors = colorDef.colors;

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

type SimpleVertexData = PolylineArgs | MeshArgs;

/**
 * Supplies vertex data from a PolylineArgs or MeshArgs. Each vertex consists of 12 bytes:
 *  pos.x           00
 *  pos.y           02
 *  pos.z           04
 *  colorIndex      06
 *  featureIndex    08
 */
class SimpleBuilder<T extends SimpleVertexData> extends VertexTableBuilder {
  public args: T;

  public constructor(args: T) {
    super();
    this.args = args;
    assert(undefined !== this.args.points);
  }

  public get numVertices() { return this.args.points!.length; }
  public get numRgbaPerVertex() { return 3; }
  public get qparams() { return this.args.points!.params; }

  public appendVertex(vertIndex: number): void {
    this.appendPosition(vertIndex);
    this.appendColorIndex(vertIndex);
    this.appendFeatureIndex(vertIndex);
  }

  protected appendPosition(vertIndex: number) {
    const points = this.args.points!;
    this.append16(points.list[vertIndex].x);
    this.append16(points.list[vertIndex].y);
    this.append16(points.list[vertIndex].z);
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
class MeshBuilder extends SimpleBuilder<MeshArgs> {
  public constructor(args: MeshArgs) { super(args); }
}

/** Supplies vertex data from a MeshArgs where each vertex consists of 16 bytes.
 * In addition to the SimpleBuilder data, the final 4 bytes hold the quantized UV params
 * The color index is left uninitialized as it is unused.
 */
class TexturedMeshBuilder extends MeshBuilder {
  private _qparams: QParams2d;
  private _qpoint = new QPoint2d();

  public constructor(args: MeshArgs, qparams: QParams2d) {
    super(args);
    this._qparams = qparams;
    assert(undefined !== args.textureUv);
  }

  public get numRgbaPerVertex() { return 4; }
  public get uvParams() { return this._qparams; }

  public appendVertex(vertIndex: number) {
    this.appendPosition(vertIndex);
    this.appendNormal(vertIndex);
    this.appendFeatureIndex(vertIndex);
    this.appendUVParams(vertIndex);
  }

  protected appendNormal(_vertIndex: number): void { this.advance(2); } // no normal for unlit meshes

  protected appendUVParams(vertIndex: number) {
    this._qpoint.init(this.args.textureUv![vertIndex], this._qparams);
    this.append16(this._qpoint.x);
    this.append16(this._qpoint.y);
  }
}

/** As with TexturedMeshBuilder, but the color index is replaced with the oct-encoded normal value. */
class TexturedLitMeshBuilder extends TexturedMeshBuilder {
  public constructor(args: MeshArgs, qparams: QParams2d) {
    super(args, qparams);
    assert(undefined !== args.normals);
  }

  protected appendNormal(vertIndex: number) { this.append16(this.args.normals![vertIndex].value); }
}

/** 16 bytes. The last 2 bytes are unused; the 2 immediately preceding it hold the oct-encoded normal value. */
class LitMeshBuilder extends MeshBuilder {
  public constructor(args: MeshArgs) {
    super(args);
    assert(undefined !== args.normals);
  }

  public get numRgbaPerVertex() { return 4; }

  public appendVertex(vertIndex: number) {
    super.appendVertex(vertIndex);
    this.append16(this.args.normals![vertIndex].value);
    this.advance(2); // 2 unused bytes
  }
}
