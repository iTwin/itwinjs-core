/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** APIs for querying memory consumed by the [[RenderSystem]].
 * Use methods like [[Viewport.collectStatistics]] and [[TileTreeReference.collectStatistics]] to query this memory usage.
 * @public
 */
export namespace RenderMemory {
  /** Describes memory consumed by a particular type of resource.
   * @internal
   */
  export class Consumers {
    public totalBytes = 0; // total number of bytes consumed by all consumers
    public maxBytes = 0; // largest number of bytes consumed by a single consumer
    public count = 0; // total number of consumers of this type

    public addConsumer(numBytes: number): void {
      this.totalBytes += numBytes;
      this.maxBytes = Math.max(this.maxBytes, numBytes);
      ++this.count;
    }

    public clear(): void {
      this.totalBytes = this.maxBytes = this.count = 0;
    }
  }

  /** @internal */
  export enum BufferType {
    Surfaces = 0,
    VisibleEdges,
    SilhouetteEdges,
    PolylineEdges,
    IndexedEdges,
    Polylines,
    PointStrings,
    PointClouds,
    Instances,
    Terrain,
    RealityMesh,

    COUNT,
  }

  /** Describes memory consumed by GPU-allocated buffers.
   * @internal
   */
  export class Buffers extends Consumers {
    public readonly consumers: Consumers[];

    public constructor() {
      super();
      this.consumers = [];
      for (let i = 0; i < BufferType.COUNT.valueOf(); i++)
        this.consumers[i] = new Consumers();
    }

    public get surfaces() { return this.consumers[BufferType.Surfaces]; }
    public get visibleEdges() { return this.consumers[BufferType.VisibleEdges]; }
    public get indexedEdges() { return this.consumers[BufferType.IndexedEdges]; }
    public get silhouetteEdges() { return this.consumers[BufferType.SilhouetteEdges]; }
    public get polylineEdges() { return this.consumers[BufferType.PolylineEdges]; }
    public get polylines() { return this.consumers[BufferType.Polylines]; }
    public get pointStrings() { return this.consumers[BufferType.PointStrings]; }
    public get pointClouds() { return this.consumers[BufferType.PointClouds]; }
    public get instances() { return this.consumers[BufferType.Instances]; }
    public get terrain() { return this.consumers[BufferType.Terrain]; }
    public get reality() { return this.consumers[BufferType.RealityMesh]; }

    public override clear(): void {
      for (const consumer of this.consumers)
        consumer.clear();

      super.clear();
    }

    public addBuffer(type: BufferType, numBytes: number): void {
      this.addConsumer(numBytes);
      this.consumers[type].addConsumer(numBytes);
    }
  }

  /** @internal */
  export enum ConsumerType {
    Textures = 0,
    VertexTables,
    EdgeTables,
    FeatureTables,
    FeatureOverrides,
    ClipVolumes,
    PlanarClassifiers,
    ShadowMaps,
    TextureAttachments,
    ThematicTextures,
    COUNT,
  }

  /** Contains statistics about the amount and type of memory consumed by the [[RenderSystem]].
   * Use methods like [[Viewport.collectStatistics]] and [[TileTreeReference.collectStatistics]] to query this memory usage.
   * @see [[Statistics.create]] to instantiate an instance of this class.
   * @public
   */
  export class Statistics {
    private _totalBytes = 0;

    /** @internal */
    public readonly consumers: Consumers[];
    /** @internal */
    public readonly buffers = new Buffers();

    /** Create a new, empty statistics object. */
    public static create(): Statistics {
      return new Statistics();
    }

    /** @internal */
    public constructor() {
      this.consumers = [];
      for (let i = 0; i < ConsumerType.COUNT.valueOf(); i++)
        this.consumers[i] = new Consumers();
    }

    /** The total reported memory consumption, in bytes.
     * @note A web browser provides no direct access to actual memory used by the host device or its graphics hardware. The reported memory usage
     * is an estimate based on the number of bytes of data requested via WebGL APIs. It is always an *under-estimate* as each WebGL implementation imposes
     * its own additional overhead.
     */
    public get totalBytes(): number { return this._totalBytes; }
    /** @internal */
    public get textures() { return this.consumers[ConsumerType.Textures]; }
    /** @internal */
    public get vertexTables() { return this.consumers[ConsumerType.VertexTables]; }
    /** @internal */
    public get edgeTables() { return this.consumers[ConsumerType.EdgeTables]; }
    /** @internal */
    public get featureTables() { return this.consumers[ConsumerType.FeatureTables]; }
    /** @internal */
    public get thematicTextures() { return this.consumers[ConsumerType.ThematicTextures]; }
    /** @internal */
    public get featureOverrides() { return this.consumers[ConsumerType.FeatureOverrides]; }
    /** @internal */
    public get clipVolumes() { return this.consumers[ConsumerType.ClipVolumes]; }
    /** @internal */
    public get planarClassifiers() { return this.consumers[ConsumerType.PlanarClassifiers]; }
    /** @internal */
    public get shadowMaps() { return this.consumers[ConsumerType.ShadowMaps]; }
    /** @internal */
    public get textureAttachments() { return this.consumers[ConsumerType.TextureAttachments]; }

    /** @internal */
    public addBuffer(type: BufferType, numBytes: number): void {
      this._totalBytes += numBytes;
      this.buffers.addBuffer(type, numBytes);
    }

    /** @internal */
    public addConsumer(type: ConsumerType, numBytes: number): void {
      this._totalBytes += numBytes;
      this.consumers[type].addConsumer(numBytes);
    }

    /** @internal */
    public clear(): void {
      this._totalBytes = 0;
      this.buffers.clear();
      for (const consumer of this.consumers)
        consumer.clear();
    }

    /** @internal */
    public addTexture(numBytes: number) { this.addConsumer(ConsumerType.Textures, numBytes); }
    /** @internal */
    public addVertexTable(numBytes: number) { this.addConsumer(ConsumerType.VertexTables, numBytes); }
    /** @internal */
    public addEdgeTable(numBytes: number) { this.addConsumer(ConsumerType.EdgeTables, numBytes); }
    /** @internal */
    public addFeatureTable(numBytes: number) { this.addConsumer(ConsumerType.FeatureTables, numBytes); }
    /** @internal */
    public addThematicTexture(numBytes: number) { this.addConsumer(ConsumerType.ThematicTextures, numBytes); }
    /** @internal */
    public addFeatureOverrides(numBytes: number) { this.addConsumer(ConsumerType.FeatureOverrides, numBytes); }
    /** @internal */
    public addClipVolume(numBytes: number) { this.addConsumer(ConsumerType.ClipVolumes, numBytes); }
    /** @internal */
    public addPlanarClassifier(numBytes: number) { this.addConsumer(ConsumerType.PlanarClassifiers, numBytes); }
    /** @internal */
    public addShadowMap(numBytes: number) { this.addConsumer(ConsumerType.ShadowMaps, numBytes); }
    /** @internal */
    public addTextureAttachment(numBytes: number) { this.addConsumer(ConsumerType.TextureAttachments, numBytes); }

    /** @internal */
    public addSurface(numBytes: number) { this.addBuffer(BufferType.Surfaces, numBytes); }
    /** @internal */
    public addVisibleEdges(numBytes: number) { this.addBuffer(BufferType.VisibleEdges, numBytes); }
    /** @internal */
    public addIndexedEdges(numBytes: number) { this.addBuffer(BufferType.IndexedEdges, numBytes); }
    /** @internal */
    public addSilhouetteEdges(numBytes: number) { this.addBuffer(BufferType.SilhouetteEdges, numBytes); }
    /** @internal */
    public addPolylineEdges(numBytes: number) { this.addBuffer(BufferType.PolylineEdges, numBytes); }
    /** @internal */
    public addPolyline(numBytes: number) { this.addBuffer(BufferType.Polylines, numBytes); }
    /** @internal */
    public addPointString(numBytes: number) { this.addBuffer(BufferType.PointStrings, numBytes); }
    /** @internal */
    public addPointCloud(numBytes: number) { this.addBuffer(BufferType.PointClouds, numBytes); }
    /** @internal */
    public addTerrain(numBytes: number) {
      this.addBuffer(BufferType.Terrain, numBytes);
    }
    /** @internal */
    public addRealityMesh(numBytes: number) {
      this.addBuffer(BufferType.RealityMesh, numBytes);
    }
    /** @internal */
    public addInstances(numBytes: number) { this.addBuffer(BufferType.Instances, numBytes); }
  }

  /** @internal */
  export interface Consumer {
    collectStatistics(stats: Statistics): void;
  }
}
