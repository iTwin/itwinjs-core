/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { RenderMode } from "@itwin/core-common";
import { EdgeTable, IndexedEdgeParams } from "../primitives/EdgeParams";
import { RenderMemory } from "../RenderMemory";
import { TextureHandle } from "./Texture";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { WebGLDisposable } from "./Disposable";
import { MeshData } from "./MeshData";
import { MeshGeometry } from "./MeshGeometry";
import { AttributeMap } from "./AttributeMap";
import { TechniqueId } from "./TechniqueId";
import { GL } from "./GL";
import { System } from "./System";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { RenderOrder } from "./RenderFlags";

/** @see [[EdgeTable]]
 * @internal
 */
export class EdgeLUT implements WebGLDisposable {
  public readonly texture: TextureHandle;
  public readonly numSegments: number;
  public readonly silhouettePadding: number;

  private constructor(texture: TextureHandle, numSegments: number, silhouettePadding: number) {
    this.texture = texture;
    this.numSegments = numSegments;
    this.silhouettePadding = silhouettePadding;
  }

  public dispose(): void {
    dispose(this.texture);
  }

  public static create(table: EdgeTable): EdgeLUT | undefined {
    const texture = TextureHandle.createForData(table.width, table.height, table.data);
    return texture ? new EdgeLUT(texture, table.numSegments, table.silhouettePadding) : undefined;
  }

  public get bytesUsed(): number {
    return this.texture.bytesUsed;
  }

  public get isDisposed(): boolean {
    return this.texture.isDisposed;
  }
}

/** @see [[IndexedEdgeParams]]
 * @internal
 */
export class IndexedEdgeGeometry extends MeshGeometry {
  private readonly _buffers: BuffersContainer;
  private readonly _indices: BufferHandle;
  public readonly edgeLut: EdgeLUT;

  public get lutBuffers() { return this._buffers; }
  public override get asIndexedEdge() { return this; }

  private constructor(mesh: MeshData, indices: BufferHandle, numIndices: number, lut: EdgeLUT) {
    super(mesh, numIndices);
    this.edgeLut = lut;
    this._buffers = BuffersContainer.create();
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.IndexedEdge, false);
    assert(undefined !== attrPos);
    this._buffers.addBuffer(indices, [BufferParameters.create(attrPos.location, 3, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this._indices = indices;
  }

  public dispose(): void {
    dispose(this._buffers);
    dispose(this._indices);
    dispose(this.edgeLut);
  }

  public get isDisposed(): boolean {
    return this._buffers.isDisposed && this._indices.isDisposed && this.edgeLut.isDisposed;
  }

  public static create(mesh: MeshData, params: IndexedEdgeParams): IndexedEdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(params.indices.data);
    const lut = EdgeLUT.create(params.edges);
    return indexBuffer && lut ? new IndexedEdgeGeometry(mesh, indexBuffer, params.indices.length, lut) : undefined;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addIndexedEdges(this._indices.bytesUsed);
    stats.addEdgeTable(this.edgeLut.bytesUsed);
  }

  protected _draw(numInstances: number, instances?: BuffersContainer): void {
    const bufs = instances ?? this._buffers;
    bufs.bind();
    System.instance.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
    bufs.unbind();
  }

  protected _wantWoWReversal(): boolean { return true; }
  protected override _getLineCode(params: ShaderProgramParams): number { return this.computeEdgeLineCode(params); }

  public get techniqueId() { return TechniqueId.IndexedEdge; }
  public getRenderPass(target: Target) { return this.computeEdgePass(target); }
  public get renderOrder() { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public override getColor(target: Target) { return this.computeEdgeColor(target); }
  public override wantMonochrome(target: Target) { return target.currentViewFlags.renderMode === RenderMode.Wireframe; }
}
