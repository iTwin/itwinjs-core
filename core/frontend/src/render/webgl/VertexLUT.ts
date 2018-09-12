/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { IDisposable, dispose } from "@bentley/bentleyjs-core";
import { QParams2d, QParams3d } from "@bentley/imodeljs-common";
import { ColorInfo } from "./ColorInfo";
import { TextureHandle } from "./Texture";
import { qparams2dToArray, qorigin3dToArray, qscale3dToArray } from "./Handle";
import { VertexTable, AuxDisplacement } from "../primitives/VertexTable";

/** Represents the finished lookup table ready for submittal to GPU. */
export class VertexLUT implements IDisposable {
  public readonly texture: TextureHandle; // Texture containing vertex data
  public readonly numVertices: number;
  public readonly numRgbaPerVertex: number;
  public readonly colorInfo: ColorInfo;
  public readonly qOrigin: Float32Array;  // Origin of quantized positions
  public readonly qScale: Float32Array;   // Scale of quantized positions
  public readonly uvQParams?: Float32Array; // If vertices contain texture UV params, quantization parameters as [origin.x, origin.y, scale.x, scale.y ]
  public readonly auxDisplacements?: AuxDisplacement[];

  public static createFromVertexTable(vt: VertexTable): VertexLUT | undefined {
    const texture = TextureHandle.createForData(vt.width, vt.height, vt.data);
    return undefined !== texture ? new VertexLUT(texture, vt, ColorInfo.createFromVertexTable(vt), vt.qparams, vt.uvParams) : undefined;
  }

  private constructor(texture: TextureHandle, table: VertexTable, colorInfo: ColorInfo, qparams: QParams3d, uvParams?: QParams2d) {
    this.texture = texture;
    this.numVertices = table.numVertices;
    this.numRgbaPerVertex = table.numRgbaPerVertex;
    this.colorInfo = colorInfo;
    this.qOrigin = qorigin3dToArray(qparams.origin);
    this.qScale = qscale3dToArray(qparams.scale);
    this.auxDisplacements = table.auxDisplacements;
    if (undefined !== uvParams) {
      this.uvQParams = qparams2dToArray(uvParams);
    }
  }

  public dispose() {
    dispose(this.texture);
  }
}
