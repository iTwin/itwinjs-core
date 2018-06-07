/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { EdgeArgs, MeshEdge } from "@bentley/imodeljs-common";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { MeshData, MeshGeometry, MeshPrimitive, MeshGraphic } from "./Mesh";
import { System } from "./System";
import { BufferHandle, AttributeHandle } from "./Handle";
import { GL } from "./GL";
import { TechniqueId } from "./TechniqueId";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { ColorInfo } from "./ColorInfo";

export class EdgeGeometry extends MeshGeometry {
  private readonly _indices: BufferHandle;
  private readonly _endPointAndQuadIndices: BufferHandle;

  public static create(mesh: MeshData, edges: MeshEdge[]): EdgeGeometry | undefined {
    // Each mesh edge becomes a quad.
    const numVerts = edges.length * 6;
    // Each primary vertex identified by vec3-encoded index into LUT
    const indexBytes = new Uint8Array(numVerts * 3);
    // Each 'other endpoint' vertex identified by vec3-encoded index into LUT plus a quad index in [0,3]
    const endPointAndQuadIndexBytes = new Uint8Array(numVerts * 4);

    const addPoint = (p0: number, p1: number, quadIndex: number) => {
      indexBytes[ndx++] = p0 & 0x000000ff;
      indexBytes[ndx++] = (p0 & 0x0000ff00) >> 8;
      indexBytes[ndx++] = (p0 & 0x00ff0000) >> 16;
      endPointAndQuadIndexBytes[ndx2++] = p1 & 0x000000ff;
      endPointAndQuadIndexBytes[ndx2++] = (p1 & 0x0000ff00) >> 8;
      endPointAndQuadIndexBytes[ndx2++] = (p1 & 0x00ff0000) >> 16;
      endPointAndQuadIndexBytes[ndx2++] = quadIndex;
    };

    let ndx: number = 0;
    let ndx2: number = 0;
    for (const meshEdge of edges) {
      const p0 = meshEdge.indices[0];
      const p1 = meshEdge.indices[1];

      addPoint(p0, p1, 0);
      addPoint(p1, p0, 2);
      addPoint(p0, p1, 1);

      addPoint(p0, p1, 1);
      addPoint(p1, p0, 2);
      addPoint(p1, p0, 3);
    }

    const indexBuffer = BufferHandle.createArrayBuffer(indexBytes);
    if (undefined !== indexBuffer) {
      const endPointAndQuadIndexBuffer = BufferHandle.createArrayBuffer(endPointAndQuadIndexBytes);
      if (undefined !== endPointAndQuadIndexBuffer)
        return new EdgeGeometry(indexBuffer, endPointAndQuadIndexBuffer, numVerts * 3, mesh);
    }
    return undefined;
  }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._indices, 3, GL.DataType.UnsignedByte, false, 0, 0);
  }

  public draw(): void {
    const gl = System.instance.context;
    this._indices.bind(GL.Buffer.Target.ArrayBuffer);
    gl.drawArrays(GL.PrimitiveType.Triangles, 0, this.numIndices);
  }

  public _wantWoWReversal(_target: Target): boolean { return true; }
  public getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }
  public getLineCode(params: ShaderProgramParams): number { return this.computeEdgeLineCode(params); }
  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.Edge; }
  public getRenderPass(target: Target): RenderPass { return this.computeEdgePass(target); }
  public get renderOrder(): RenderOrder { return this.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }
  public getColor(target: Target): ColorInfo { return this.computeEdgeColor(target); }
  public get endPointAndQuadIndices(): BufferHandle { return this._endPointAndQuadIndices; }

  private constructor(indices: BufferHandle, endPointAndQuadsIndices: BufferHandle, numIndices: number, mesh: MeshData) {
    super(mesh, numIndices);
    this._indices = indices;
    this._endPointAndQuadIndices = endPointAndQuadsIndices;
  }
}

export class EdgePrimitive extends MeshPrimitive {
  public static create(args: EdgeArgs, mesh: MeshGraphic): EdgePrimitive | undefined {
    if (undefined === args.edges) {
      assert(false);
      return undefined;
    }

    const geom = EdgeGeometry.create(mesh.meshData, args.edges);
    return undefined !== geom ? new EdgePrimitive(geom, mesh) : undefined;
  }

  private constructor(cachedGeom: EdgeGeometry, mesh: MeshGraphic) {
    super(cachedGeom, mesh);
  }

  public get renderOrder(): RenderOrder { return this.meshData.isPlanar ? RenderOrder.PlanarEdge : RenderOrder.Edge; }

  public get isEdge(): boolean { return true; }
}
