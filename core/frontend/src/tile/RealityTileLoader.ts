/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream } from "@itwin/core-bentley";
import { Point2d, Point3d, Transform } from "@itwin/core-geometry";
import { BatchType, CompositeTileHeader, TileFormat, ViewFlagOverrides } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderSystem } from "../render/RenderSystem";
import { ScreenViewport, Viewport } from "../Viewport";
import { GltfWrapMode } from "../common/gltf/GltfSchema";
import {
  B3dmReader, BatchedTileIdMap, createDefaultViewFlagOverrides, GltfGraphicsReader, GltfReader, GltfReaderProps, I3dmReader, ImdlReader, readPointCloudTileContent,
  RealityTile, RealityTileContent, Tile, TileContent, TileDrawArgs, TileLoadPriority, TileRequest, TileRequestChannel, TileUser,
} from "./internal";

const defaultViewFlagOverrides = createDefaultViewFlagOverrides({});

const scratchTileCenterWorld = new Point3d();
const scratchTileCenterView = new Point3d();

/** Serves as a "handler" for a specific type of [[TileTree]]. Its primary responsibilities involve loading tile content.
 * @internal
 */
export abstract class RealityTileLoader {
  private _containsPointClouds = false;
  public readonly preloadRealityParentDepth: number;
  public readonly preloadRealityParentSkip: number;

  public constructor(private _produceGeometry?: boolean) {
    this.preloadRealityParentDepth = IModelApp.tileAdmin.contextPreloadParentDepth;
    this.preloadRealityParentSkip = IModelApp.tileAdmin.contextPreloadParentSkip;
  }

  public computeTilePriority(tile: Tile, viewports: Iterable<Viewport>, _users: Iterable<TileUser>): number {
    // ###TODO: Handle case where tile tree reference(s) have a transform different from tree's (background map with ground bias).
    return RealityTileLoader.computeTileLocationPriority(tile, viewports, tile.tree.iModelTransform);
  }

  public abstract loadChildren(tile: RealityTile): Promise<Tile[] | undefined>;
  public abstract getRequestChannel(tile: Tile): TileRequestChannel;
  public abstract requestTileContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response>;
  public get wantDeduplicatedVertices(): boolean { return false; }
  public abstract get maxDepth(): number;
  public abstract get minDepth(): number;
  public abstract get priority(): TileLoadPriority;
  protected get _batchType(): BatchType { return BatchType.Primary; }
  protected get _loadEdges(): boolean { return true; }
  public getBatchIdMap(): BatchedTileIdMap | undefined { return undefined; }
  public get isContentUnbounded(): boolean { return false; }
  public get containsPointClouds(): boolean { return this._containsPointClouds; }
  public get parentsAndChildrenExclusive(): boolean { return true; }
  public forceTileLoad(_tile: Tile): boolean { return false; }
  public get maximumScreenSpaceError(): number | undefined { return undefined; }

  public processSelectedTiles(selected: Tile[], _args: TileDrawArgs): Tile[] { return selected; }

  // NB: The isCanceled arg is chiefly for tests...in usual case it just returns false if the tile is no longer in 'loading' state.
  public async loadTileContent(tile: Tile, data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<RealityTileContent> {
    assert(data instanceof Uint8Array);
    const blob = data;
    const streamBuffer = ByteStream.fromUint8Array(blob);
    const realityTile = tile as RealityTile;
    return this._produceGeometry ? this.loadGeometryFromStream(realityTile, streamBuffer, system) : this.loadGraphicsFromStream(realityTile, streamBuffer, system, isCanceled);
  }

  private _getFormat(streamBuffer: ByteStream) {
    const position = streamBuffer.curPos;
    const format = streamBuffer.readUint32();
    streamBuffer.curPos = position;
    return format;

  }

  public async loadGeometryFromStream(tile: RealityTile, streamBuffer: ByteStream, system: RenderSystem): Promise<RealityTileContent> {
    const format = this._getFormat(streamBuffer);
    if (format !== TileFormat.B3dm)
      return {};

    const { is3d, yAxisUp, iModel, modelId } = tile.realityRoot;
    const reader = B3dmReader.create(streamBuffer, iModel, modelId, is3d, tile.contentRange, system, yAxisUp, tile.isLeaf, tile.center, tile.transformToRoot, undefined, this.getBatchIdMap());
    if (reader)
      reader.defaultWrapMode = GltfWrapMode.ClampToEdge;

    return { geometry: reader?.readGltfAndCreateGeometry(tile.tree.iModelTransform) };
  }

  private async loadGraphicsFromStream(tile: RealityTile, streamBuffer: ByteStream, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent> {
    const format = this._getFormat(streamBuffer);
    if (undefined === isCanceled)
      isCanceled = () => !tile.isLoading;

    const { is3d, yAxisUp, iModel, modelId } = tile.realityRoot;
    let reader: GltfReader | ImdlReader | undefined;
    switch (format) {
      case TileFormat.IModel:
        reader = ImdlReader.create({
          stream: streamBuffer,
          iModel,
          modelId,
          is3d,
          system,
          isCanceled,
        });
        break;
      case TileFormat.Pnts:
        this._containsPointClouds = true;
        const res = await readPointCloudTileContent(streamBuffer, iModel, modelId, is3d, tile, system);
        let graphic = res.graphic;
        const rtcCenter = res.rtcCenter;
        if (graphic && (rtcCenter || tile.transformToRoot && !tile.transformToRoot.isIdentity)) {
          const transformBranch = new GraphicBranch(true);
          transformBranch.add(graphic);
          let xform: Transform;
          if (!tile.transformToRoot && rtcCenter)
            xform = Transform.createTranslation(rtcCenter);
          else {
            if (rtcCenter)
              xform = Transform.createOriginAndMatrix(rtcCenter.plus(tile.transformToRoot!.origin), tile.transformToRoot!.matrix);
            else
              xform = tile.transformToRoot!;
          }
          graphic = system.createBranch(transformBranch, xform);
        }

        return { graphic };
      case TileFormat.B3dm:
        reader = B3dmReader.create(streamBuffer, iModel, modelId, is3d, tile.contentRange, system, yAxisUp, tile.isLeaf, tile.center, tile.transformToRoot, isCanceled, this.getBatchIdMap(), this.wantDeduplicatedVertices);
        break;
      case TileFormat.I3dm:
        reader = I3dmReader.create(streamBuffer, iModel, modelId, is3d, tile.contentRange, system, yAxisUp, tile.isLeaf, isCanceled, undefined, this.wantDeduplicatedVertices);
        break;
      case TileFormat.Gltf:
        const props = GltfReaderProps.create(streamBuffer.nextBytes(streamBuffer.arrayBuffer.byteLength), yAxisUp);
        if (props) {
          reader = new GltfGraphicsReader(props, {
            iModel,
            gltf: props.glTF,
            contentRange: tile.contentRange,
            transform: tile.transformToRoot,
            hasChildren: !tile.isLeaf,
          });
        }

        break;
      case TileFormat.Cmpt:
        const header = new CompositeTileHeader(streamBuffer);
        if (!header.isValid)
          return {};

        const branch = new GraphicBranch(true);
        for (let i = 0; i < header.tileCount; i++) {
          const tilePosition = streamBuffer.curPos;
          streamBuffer.advance(8);    // Skip magic and version.
          const tileBytes = streamBuffer.readUint32();
          streamBuffer.curPos = tilePosition;
          const result = await this.loadGraphicsFromStream(tile, streamBuffer, system, isCanceled);
          if (result.graphic)
            branch.add(result.graphic);
          streamBuffer.curPos = tilePosition + tileBytes;
        }
        return { graphic: branch.isEmpty ? undefined : system.createBranch(branch, Transform.createIdentity()), isLeaf: tile.isLeaf };

      default:
        assert(false, `unknown tile format ${format}`);
        break;
    }

    let content: TileContent = {};
    if (undefined !== reader) {
      // glTF spec defaults wrap mode to "repeat" but many reality tiles omit the wrap mode and should not repeat.
      // The render system also currently only produces mip-maps for repeating textures, and we don't want mip-maps for reality tile textures.
      if (reader instanceof GltfReader)
        reader.defaultWrapMode = GltfWrapMode.ClampToEdge;
      try {
        content = await reader.read();
      } catch (_err) {
        // Failure to load should prevent us from trying to load children
        content.isLeaf = true;
      }
    }

    return content;
  }

  public get viewFlagOverrides(): ViewFlagOverrides { return defaultViewFlagOverrides; }

  public static computeTileLocationPriority(tile: Tile, viewports: Iterable<Viewport>, location: Transform): number {
    // Compute a priority value for tiles that are:
    // * Closer to the eye;
    // * Closer to the center of attention (center of the screen or zoom target).
    // This way, we can load in priority tiles that are more likely to be important.
    let center: Point3d | undefined;
    let minDistance = 1.0;

    const currentInputState = IModelApp.toolAdmin.currentInputState;
    const now = Date.now();
    const wheelEventRelevanceTimeout = 1000; // Wheel events older than this value will not be considered

    for (const viewport of viewports) {
      center = center ?? location.multiplyPoint3d(tile.center, scratchTileCenterWorld);
      const npc = viewport.worldToNpc(center, scratchTileCenterView);

      let focusPoint = new Point2d(0.5, 0.5);

      if (currentInputState.viewport === viewport && viewport instanceof ScreenViewport) {
        // Try to get a better target point from the last zoom target
        const { lastWheelEvent } = currentInputState;

        if (lastWheelEvent !== undefined && now - lastWheelEvent.time < wheelEventRelevanceTimeout) {
          const focusPointCandidate = Point2d.fromJSON(viewport.worldToNpc(lastWheelEvent.point));

          if (focusPointCandidate.x > 0 && focusPointCandidate.x < 1 && focusPointCandidate.y > 0 && focusPointCandidate.y < 1)
            focusPoint = focusPointCandidate;
        }
      }

      // NB: In NPC coords, 0 = far plane, 1 = near plane.
      const distanceToEye = 1.0 - npc.z;
      const distanceToCenter = Math.min(npc.distanceXY(focusPoint) / 0.707, 1.0); // Math.sqrt(0.5) = 0.707

      // Distance is a mix of the two previously computed values, still in range [0; 1]
      // We use this factor to determine how much the distance to the center of attention is important compared to distance to the eye
      const distanceToCenterWeight = 0.3;
      const distance = distanceToEye * (1.0 - distanceToCenterWeight) + distanceToCenter * distanceToCenterWeight;

      minDistance = Math.min(distance, minDistance);
    }

    return minDistance;
  }
}
