/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ColorDef, ColorIndex, QPoint2d, QParams2d, QParams3d } from "@bentley/imodeljs-common";
import { LUTDimensions } from "./FeatureDimensions";
import { ColorInfo } from "./ColorInfo";
import { MeshArgs, PolylineArgs } from "../primitives/mesh/MeshPrimitives";
import { TextureHandle } from "./Texture";
import { qparams2dToArray, qorigin3dToArray, qscale3dToArray } from "./Handle";
import { VertexTable } from "../primitives/VertexTable";

export namespace VertexLUT {
  /**
   * Stores vertex data (position, color ID, normal, UV params, etc) in a rectangular array
   * which will later be converted to a texture. Given a vertex ID, vertex shaders can sample
   * that texture to extract the vertex data. If vertex data contains indices into a color table,
   * the color table itself will be appended to the array following the vertex data.
   */
  export class Params {
    public readonly data: Uint8Array;
    public readonly dimensions: LUTDimensions;
    public readonly colorInfo: ColorInfo;
    public readonly numVertices: number;
    public readonly numRgbaPerVertex: number;

    /** Construct a VertexLUT.Params using the vertex data supplied by the Builder */
    public constructor(builder: Builder, colorIndex: ColorIndex) {
      this.numVertices = builder.numVertices;
      this.numRgbaPerVertex = builder.numRgbaPerVertex;
      const numColors = colorIndex.isUniform ? 0 : colorIndex.numColors;
      this.colorInfo = ColorInfo.createFromColorIndex(colorIndex);
      this.dimensions = new LUTDimensions(this.numVertices, this.numRgbaPerVertex, numColors);
      assert(0 === this.dimensions.width % this.numRgbaPerVertex || (0 < numColors && 1 === this.dimensions.height));

      this.data = new Uint8Array(this.dimensions.width * this.dimensions.height * 4);

      builder.params = this;
      for (let i = 0; i < this.numVertices; i++) {
        builder.appendVertex(i);
      }

      builder.appendColorTable(colorIndex);

      builder.params = undefined;
    }

    public toTexture(): TextureHandle | undefined {
      return TextureHandle.createForData(this.dimensions.width, this.dimensions.height, this.data);
    }

    public toData(qparams: QParams3d, uvParams?: QParams2d): Data | undefined {
      return Data.create(this, qparams, uvParams);
    }
  }

  /** Represents the finished lookup table ready for submittal to GPU. */
  export class Data implements IDisposable {
    public readonly texture: TextureHandle; // Texture containing vertex data
    public readonly numVertices: number;
    public readonly numRgbaPerVertex: number;
    public readonly colorInfo: ColorInfo;
    public readonly qOrigin: Float32Array;  // Origin of quantized positions
    public readonly qScale: Float32Array;   // Scale of quantized positions
    public readonly uvQParams?: Float32Array; // If vertices contain texture UV params, quantization parameters as [origin.x, origin.y, scale.x, scale.y ]

    public static create(params: Params, qparams: QParams3d, uvParams?: QParams2d) {
      const texture = params.toTexture();
      return undefined !== texture ? new Data(texture, params, params.colorInfo, qparams, uvParams) : undefined;
    }

    public static createFromVertexTable(vt: VertexTable): Data | undefined {
      const texture = TextureHandle.createForData(vt.width, vt.height, vt.data);
      return undefined !== texture ? new Data(texture, vt, ColorInfo.createFromVertexTable(vt), vt.qparams, vt.uvParams) : undefined;
    }

    private constructor(texture: TextureHandle, params: Params | VertexTable, colorInfo: ColorInfo, qparams: QParams3d, uvParams?: QParams2d) {
      this.texture = texture;
      this.numVertices = params.numVertices;
      this.numRgbaPerVertex = params.numRgbaPerVertex;
      this.colorInfo = colorInfo;
      this.qOrigin = qorigin3dToArray(qparams.origin);
      this.qScale = qscale3dToArray(qparams.scale);
      if (undefined !== uvParams) {
        this.uvQParams = qparams2dToArray(uvParams);
      }
    }

    public dispose() {
      dispose(this.texture);
    }
  }

  const scratchColorDef = new ColorDef();

  /** Builds a VertexLUT.Params from some data type supplying the vertex data. */
  export abstract class Builder {
    public params?: Params;
    private _curIndex: number = 0;

    public abstract get numVertices(): number;
    public abstract get numRgbaPerVertex(): number;
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
      assert(this._curIndex <= this.params!.data.length);
    }

    protected append8(val: number) {
      assert(0 <= val);
      assert(val <= 0xff);
      assert(val === Math.floor(val));

      this.params!.data[this._curIndex] = val;
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

  export type SimpleVertexData = PolylineArgs | MeshArgs;

  /**
   * Supplies vertex data from a PolylineArgs or MeshArgs. Each vertex consists of 12 bytes:
   *  pos.x           00
   *  pos.y           02
   *  pos.z           04
   *  colorIndex      06
   *  featureIndex    08
   */
  export class SimpleBuilder<T extends SimpleVertexData> extends Builder {
    public args: T;

    public constructor(args: T) {
      super();
      this.args = args;
      assert(undefined !== this.args.points);
    }

    public get numVertices() { return this.args.points!.length; }
    public get numRgbaPerVertex() { return 3; }

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
  export class MeshBuilder extends SimpleBuilder<MeshArgs> {
    public constructor(args: MeshArgs) { super(args); }
  }

  /** Supplies vertex data from a MeshArgs where each vertex consists of 16 bytes.
   * In addition to the SimpleBuilder data, the final 4 bytes hold the quantized UV params
   * The color index is left uninitialized as it is unused.
   */
  export class TexturedMeshBuilder extends MeshBuilder {
    private _qparams: QParams2d;
    private _qpoint = new QPoint2d();

    public constructor(args: MeshArgs, qparams: QParams2d) {
      super(args);
      this._qparams = qparams;
      assert(undefined !== args.textureUv);
    }

    public get numRgbaPerVertex() { return 4; }

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
  export class TexturedLitMeshBuilder extends TexturedMeshBuilder {
    public constructor(args: MeshArgs, qparams: QParams2d) {
      super(args, qparams);
      assert(undefined !== args.normals);
    }

    protected appendNormal(vertIndex: number) { this.append16(this.args.normals![vertIndex].value); }
  }

  /** 16 bytes. The last 2 bytes are unused; the 2 immediately preceding it hold the oct-encoded normal value. */
  export class LitMeshBuilder extends MeshBuilder {
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

  // Given 32-bit unsigned integer vertex indices, convert each to a vec3 in which each component is one byte of the index.
  // Requires the high 8 bits of the indices are unused.
  // These are decoded in the vertex shader to obtain the index as a float (hence the 24-bit restriction).
  export function convertIndicesToTriplets(indices: number[]): Uint8Array {
    const bytes = new Uint8Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const j = i * 3;
      bytes[j + 0] = index & 0x000000ff;
      bytes[j + 1] = (index & 0x0000ff00) >> 8;
      bytes[j + 2] = (index & 0x00ff0000) >> 16;
    }

    return bytes;
  }
}
