/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { MeshParams } from "../../common/internal/render/MeshParams";
import { SurfaceType } from "../../common/internal/render/SurfaceParams";
import { RenderMemory } from "../RenderMemory";
import { CachedGeometry } from "./CachedGeometry";
import { Graphic } from "./Graphic";
import { InstanceBuffers, PatternBuffers } from "./InstancedGeometry";
import { Primitive } from "./Primitive";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { EdgeGeometry, PolylineEdgeGeometry, SilhouetteEdgeGeometry } from "./EdgeGeometry";
import { IndexedEdgeGeometry } from "./IndexedEdgeGeometry";
import { SurfaceGeometry } from "./SurfaceGeometry";
import { MeshData } from "./MeshData";
import { RenderGeometry } from "../../internal/render/RenderGeometry";

/** @internal */
export class MeshRenderGeometry implements RenderGeometry {
  public readonly renderGeometryType: "mesh" = "mesh" as const;
  public readonly isInstanceable: boolean;
  public noDispose = false;
  public readonly data: MeshData;
  public readonly surface?: SurfaceGeometry;
  public readonly segmentEdges?: EdgeGeometry;
  public readonly silhouetteEdges?: SilhouetteEdgeGeometry;
  public readonly polylineEdges?: PolylineEdgeGeometry;
  public readonly indexedEdges?: IndexedEdgeGeometry;
  public readonly range: Range3d;

  private constructor(data: MeshData, params: MeshParams) {
    this.data = data;
    this.isInstanceable = data.viewIndependentOrigin === undefined;
    this.range = params.vertices.qparams.computeRange();
    this.surface = SurfaceGeometry.create(data, params.surface.indices);
    const edges = params.edges;
    if (!edges || data.type === SurfaceType.VolumeClassifier)
      return;

    if (edges.silhouettes)
      this.silhouetteEdges = SilhouetteEdgeGeometry.createSilhouettes(data, edges.silhouettes);

    if (edges.segments)
      this.segmentEdges = EdgeGeometry.create(data, edges.segments);

    if (edges.polylines)
      this.polylineEdges = PolylineEdgeGeometry.create(data, edges.polylines);

    if (edges.indexed)
      this.indexedEdges = IndexedEdgeGeometry.create(data, edges.indexed);
  }

  public static create(params: MeshParams, viewIndependentOrigin: Point3d | undefined): MeshRenderGeometry | undefined {
    const data = MeshData.create(params, viewIndependentOrigin);
    return data ? new this(data, params) : undefined;
  }

  public dispose() {
    if (this.noDispose) {
      return;
    }

    dispose(this.data);
    dispose(this.surface);
    dispose(this.segmentEdges);
    dispose(this.silhouetteEdges);
    dispose(this.polylineEdges);
    dispose(this.indexedEdges);
  }

  public get isDisposed() {
    return this.data.isDisposed &&
      (!this.surface || this.surface.isDisposed) &&
      (!this.segmentEdges || this.segmentEdges.isDisposed) &&
      (!this.silhouetteEdges || this.silhouetteEdges.isDisposed) &&
      (!this.polylineEdges || this.polylineEdges.isDisposed) &&
      (!this.indexedEdges || this.indexedEdges.isDisposed);
  }

  public collectStatistics(stats: RenderMemory.Statistics) {
    this.data.collectStatistics(stats);
    this.surface?.collectStatistics(stats);
    this.segmentEdges?.collectStatistics(stats);
    this.silhouetteEdges?.collectStatistics(stats);
    this.polylineEdges?.collectStatistics(stats);
    this.indexedEdges?.collectStatistics(stats);
  }

  public computeRange(out?: Range3d): Range3d {
    return this.range.clone(out);
  }
}

/** @internal */
export class MeshGraphic extends Graphic {
  public readonly meshData: MeshData;
  private readonly _primitives: Primitive[] = [];
  private readonly _instances?: InstanceBuffers | PatternBuffers;
  private readonly _meshRange: Range3d;

  public get primitives(): readonly Primitive[] { return this._primitives; }
  public get meshRange(): Readonly<Range3d> { return this._meshRange; }

  public static create(geometry: MeshRenderGeometry, instances?: InstanceBuffers | PatternBuffers): MeshGraphic | undefined {
    return new MeshGraphic(geometry, instances);
  }

  private addPrimitive(geometry: CachedGeometry | undefined) {
    if (!geometry)
      return;

    const primitive = Primitive.createShared(geometry, this._instances);
    if (primitive)
      this._primitives.push(primitive);
  }

  private constructor(geometry: MeshRenderGeometry, instances?: InstanceBuffers | PatternBuffers) {
    super();
    this.meshData = geometry.data;
    this._meshRange = geometry.range;
    this._instances = instances;

    this.addPrimitive(geometry.surface);
    this.addPrimitive(geometry.segmentEdges);
    this.addPrimitive(geometry.silhouetteEdges);
    this.addPrimitive(geometry.polylineEdges);
    this.addPrimitive(geometry.indexedEdges);
  }

  public get isDisposed(): boolean { return this.meshData.isDisposed && 0 === this._primitives.length; }
  public get isPickable() { return false; }

  public dispose() {
    for (const primitive of this._primitives)
      dispose(primitive);

    dispose(this.meshData);
    dispose(this._instances);
    this._primitives.length = 0;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.meshData.collectStatistics(stats);
    this._primitives.forEach((prim) => prim.collectStatistics(stats));
    this._instances?.collectStatistics(stats);
  }

  public override unionRange(range: Range3d) {
    if (this._instances)
      range.extendRange(range);
    else
      range.extendRange(this._meshRange);
  }

  public addCommands(cmds: RenderCommands): void { this._primitives.forEach((prim) => prim.addCommands(cmds)); }
  public override addHiliteCommands(cmds: RenderCommands, pass: RenderPass): void { this._primitives.forEach((prim) => prim.addHiliteCommands(cmds, pass)); }

  public get surfaceType(): SurfaceType { return this.meshData.type; }
}
