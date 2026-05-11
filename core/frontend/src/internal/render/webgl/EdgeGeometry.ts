/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { EdgeAppearanceOverrides, RenderMode } from "@itwin/core-common";
import { RenderMemory } from "../../../render/RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { PolylineBuffers } from "./CachedGeometry";
import { ColorInfo } from "./ColorInfo";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { RenderOrder } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { MeshData } from "./MeshData";
import { MeshGeometry } from "./MeshGeometry";
import { PolylineEdgeGroup, SegmentEdgeParams, SilhouetteParams } from "../../../common/internal/render/EdgeParams";
import { lineCodeFromLinePixels } from "../../../common/internal/render/LineCode";

/** @internal */
export class EdgeGeometry extends MeshGeometry {
  public readonly buffers: BuffersContainer;
  protected readonly _indices: BufferHandle;
  protected readonly _endPointAndQuadIndices: BufferHandle;

  public get lutBuffers() { return this.buffers; }
  public override get asSurface() { return undefined; }
  public override get asEdge() { return this; }
  public override get asSilhouette(): SilhouetteEdgeGeometry | undefined { return undefined; }

  public static create(mesh: MeshData, edges: SegmentEdgeParams): EdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(edges.indices.data);
    const endPointBuffer = BufferHandle.createArrayBuffer(edges.endPointAndQuadIndices);
    return undefined !== indexBuffer && undefined !== endPointBuffer ? new EdgeGeometry(indexBuffer, endPointBuffer, edges.indices.length, mesh) : undefined;
  }

  public get isDisposed(): boolean {
    return this.buffers.isDisposed
      && this._indices.isDisposed
      && this._endPointAndQuadIndices.isDisposed;
  }

  public [Symbol.dispose]() {
    dispose(this.buffers);
    dispose(this._indices);
    dispose(this._endPointAndQuadIndices);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addVisibleEdges(this._indices.bytesUsed + this._endPointAndQuadIndices.bytesUsed);
  }

  protected _draw(numInstances: number, instanceBuffersContainer?: BuffersContainer): void {
    const bufs = instanceBuffersContainer !== undefined ? instanceBuffersContainer : this.buffers;

    bufs.bind();
    System.instance.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
    bufs.unbind();
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }
  protected override _getLineCode(params: ShaderProgramParams): number { return this.computeEdgeLineCode(params); }
  public get techniqueId(): TechniqueId { return TechniqueId.Edge; }
  public override getPass(target: Target) { return this.computeEdgePass(target); }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public override getColor(target: Target): ColorInfo { return this.computeEdgeColor(target); }
  public get endPointAndQuadIndices(): BufferHandle { return this._endPointAndQuadIndices; }
  public override wantMonochrome(target: Target): boolean {
    return target.currentViewFlags.renderMode === RenderMode.Wireframe;
  }

  protected constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, numIndices: number, mesh: MeshData) {
    super(mesh, numIndices);
    this.buffers = BuffersContainer.create();
    const attrPos = AttributeMap.findAttribute("a_pos", TechniqueId.Edge, false);
    const attrEndPointAndQuadIndices = AttributeMap.findAttribute("a_endPointAndQuadIndices", TechniqueId.Edge, false);
    assert(attrPos !== undefined);
    assert(attrEndPointAndQuadIndices !== undefined);
    this.buffers.addBuffer(indices, [BufferParameters.create(attrPos.location, 3, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this.buffers.addBuffer(endPointAndQuadsIndices, [BufferParameters.create(attrEndPointAndQuadIndices.location, 4, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this._indices = indices;
    this._endPointAndQuadIndices = endPointAndQuadsIndices;
  }
}

/** @internal */
export class SilhouetteEdgeGeometry extends EdgeGeometry {
  private readonly _normalPairs: BufferHandle;

  public override get asSilhouette() { return this; }

  public static createSilhouettes(mesh: MeshData, params: SilhouetteParams): SilhouetteEdgeGeometry | undefined {
    const indexBuffer = BufferHandle.createArrayBuffer(params.indices.data);
    const endPointBuffer = BufferHandle.createArrayBuffer(params.endPointAndQuadIndices);
    const normalsBuffer = BufferHandle.createArrayBuffer(params.normalPairs);
    return undefined !== indexBuffer && undefined !== endPointBuffer && undefined !== normalsBuffer ? new SilhouetteEdgeGeometry(indexBuffer, endPointBuffer, normalsBuffer, params.indices.length, mesh) : undefined;
  }

  public override get isDisposed(): boolean { return super.isDisposed && this._normalPairs.isDisposed; }

  public override[Symbol.dispose]() {
    super[Symbol.dispose]();
    dispose(this._normalPairs);
  }

  public override collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addSilhouetteEdges(this._indices.bytesUsed + this._endPointAndQuadIndices.bytesUsed + this._normalPairs.bytesUsed);
  }

  public override get techniqueId(): TechniqueId { return TechniqueId.SilhouetteEdge; }
  public override get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarSilhouette : RenderOrder.Silhouette; }
  public get normalPairs(): BufferHandle { return this._normalPairs; }

  private constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, normalPairs: BufferHandle, numIndices: number, mesh: MeshData) {
    super(indices, endPointAndQuadsIndices, numIndices, mesh);
    const attrNormals = AttributeMap.findAttribute("a_normals", TechniqueId.SilhouetteEdge, false);
    assert(attrNormals !== undefined);
    this.buffers.addBuffer(normalPairs, [BufferParameters.create(attrNormals.location, 4, GL.DataType.UnsignedByte, false, 0, 0, false)]);
    this._normalPairs = normalPairs;
  }
}

/** @internal */
export class PolylineEdgeGeometry extends MeshGeometry {
  private _buffers: PolylineBuffers;
  private readonly _colorInfo: ColorInfo;
  private readonly _width: number;
  private readonly _lineCode: number;

  public get lutBuffers() { return this._buffers.buffers; }

  public static create(mesh: MeshData, group: PolylineEdgeGroup): PolylineEdgeGeometry | undefined {
    const buffers = PolylineBuffers.create(group.polyline);
    return undefined !== buffers ? new PolylineEdgeGeometry(group.polyline.indices.length, buffers, mesh, group.appearance) : undefined;
  }

  public get isDisposed(): boolean { return this._buffers.isDisposed; }

  public [Symbol.dispose]() {
    dispose(this._buffers);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._buffers.collectStatistics(stats, RenderMemory.BufferType.PolylineEdges);
  }

  protected _wantWoWReversal(_target: Target): boolean { return true; }
  public get techniqueId(): TechniqueId { return TechniqueId.Polyline; }
  public override getPass(target: Target) { return this.computeEdgePass(target); }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public override get polylineBuffers(): PolylineBuffers { return this._buffers; }

  protected override _getLineCode(params: ShaderProgramParams): number {
    return params.target.computeEdgeLineCode(params.renderPass, this._lineCode);
  }

  protected override _getLineWeight(params: ShaderProgramParams): number {
    return params.target.computeEdgeWeight(params.renderPass, this._width);
  }

  public override getColor(target: Target) {
    return target.computeEdgeColor(this._colorInfo);
  }

  public override wantMonochrome(target: Target): boolean {
    return target.currentViewFlags.renderMode === RenderMode.Wireframe;
  }

  protected _draw(numInstances: number, instanceBuffersContainer?: BuffersContainer): void {
    const gl = System.instance;
    const bufs = instanceBuffersContainer !== undefined ? instanceBuffersContainer : this._buffers.buffers;

    bufs.bind();
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this._numIndices, numInstances);
    bufs.unbind();
  }

  private constructor(numIndices: number, buffers: PolylineBuffers, mesh: MeshData, appearance: EdgeAppearanceOverrides | undefined) {
    super(mesh, numIndices);
    this._buffers = buffers;

    this._colorInfo = appearance?.color ? ColorInfo.createFromColorDef(appearance.color) : mesh.lut.colorInfo;
    this._width = appearance?.width ?? mesh.edgeWidth;
    this._lineCode = appearance?.linePixels ? lineCodeFromLinePixels(appearance?.linePixels) : mesh.edgeLineCode;
  }
}
