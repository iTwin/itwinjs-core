/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@bentley/bentleyjs-core";
import { QParams2d, QParams3d } from "@bentley/imodeljs-common";
import { AuxChannel, AuxChannelTable, AuxDisplacementChannel, AuxParamChannel } from "../primitives/AuxChannelTable";
import { VertexTable } from "../primitives/VertexTable";
import { ColorInfo } from "./ColorInfo";
import { WebGLDisposable } from "./Disposable";
import { qorigin3dToArray, qparams2dToArray, qscale3dToArray } from "./AttributeBuffers";
import { TextureHandle } from "./Texture";

type ChannelPropName = "normals" | "displacements" | "params";

/** @internal */
export class AuxChannelLUT implements WebGLDisposable {
  public readonly texture: TextureHandle;
  public readonly numVertices: number;
  public readonly numBytesPerVertex: number;
  public displacements?: Map<string, AuxDisplacementChannel>;
  public normals?: Map<string, AuxChannel>;
  public params?: Map<string, AuxParamChannel>;

  private constructor(texture: TextureHandle, table: AuxChannelTable) {
    this.texture = texture;
    this.numVertices = table.numVertices;
    this.numBytesPerVertex = table.numBytesPerVertex;

    this.initChannels<AuxDisplacementChannel>(table, "displacements");
    this.initChannels<AuxChannel>(table, "normals");
    this.initChannels<AuxParamChannel>(table, "params");
  }

  private initChannels<T extends AuxChannel>(table: AuxChannelTable, name: ChannelPropName): void {
    const channels = table[name];
    if (undefined === channels)
      return;

    const map = new Map<string, T>();

    // TS2322: Type 'Map<string, T>' is not assignable to type 'Map<string, AuxChannel> & Map<string, AuxDisplacementChannel> & Map<string, AuxParamChannel>'.
    // (Compiler cannot detect that the specific property name is matched to the correct subtype at each call site - but we know that).
    this[name] = map as any;
    for (const channel of channels)
      map.set(channel.name, channel as T);
  }

  public get bytesUsed(): number { return this.texture.bytesUsed; }
  public get hasScalarAnimation() { return undefined !== this.params; }

  public get isDisposed(): boolean { return this.texture.isDisposed; }

  public dispose() {
    dispose(this.texture);
  }

  public static create(table: AuxChannelTable): AuxChannelLUT | undefined {
    const texture = TextureHandle.createForData(table.width, table.height, table.data);
    return undefined !== texture ? new AuxChannelLUT(texture, table) : undefined;
  }
}

/** Represents the finished lookup table ready for submittal to GPU.
 * @internal
 */
export class VertexLUT implements WebGLDisposable {
  public readonly texture: TextureHandle; // Texture containing vertex data
  public readonly numVertices: number;
  public readonly numRgbaPerVertex: number;
  public readonly colorInfo: ColorInfo;
  public readonly qOrigin: Float32Array;  // Origin of quantized positions
  public readonly qScale: Float32Array;   // Scale of quantized positions
  public readonly uvQParams?: Float32Array; // If vertices contain texture UV params, quantization parameters as [origin.x, origin.y, scale.x, scale.y ]
  public readonly auxChannels?: AuxChannelLUT;

  public get hasAnimation() { return undefined !== this.auxChannels; }
  public get hasScalarAnimation() { return undefined !== this.auxChannels && this.auxChannels.hasScalarAnimation; }

  public get bytesUsed(): number {
    let bytesUsed = this.texture.bytesUsed;
    if (undefined !== this.auxChannels)
      bytesUsed += this.auxChannels.bytesUsed;

    return bytesUsed;
  }

  public static createFromVertexTable(vt: VertexTable, aux?: AuxChannelTable): VertexLUT | undefined {
    const texture = TextureHandle.createForData(vt.width, vt.height, vt.data);
    if (undefined === texture)
      return undefined;

    const auxLUT = undefined !== aux ? AuxChannelLUT.create(aux) : undefined;
    return new VertexLUT(texture, vt, ColorInfo.createFromVertexTable(vt), vt.qparams, vt.uvParams, auxLUT);
  }

  private constructor(texture: TextureHandle, table: VertexTable, colorInfo: ColorInfo, qparams: QParams3d, uvParams?: QParams2d, auxChannels?: AuxChannelLUT) {
    this.texture = texture;
    this.numVertices = table.numVertices;
    this.numRgbaPerVertex = table.numRgbaPerVertex;
    this.colorInfo = colorInfo;
    this.qOrigin = qorigin3dToArray(qparams.origin);
    this.qScale = qscale3dToArray(qparams.scale);
    this.auxChannels = auxChannels;

    if (undefined !== uvParams)
      this.uvQParams = qparams2dToArray(uvParams);
  }

  public get isDisposed(): boolean { return this.texture.isDisposed; }

  public dispose() {
    dispose(this.texture);
  }
}
