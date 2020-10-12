/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeDuration, BeTimePoint, DbOpcode, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Range3d, Transform } from "@bentley/geometry-core";
import {
  BatchType, ContentIdProvider, ElementAlignedBox3d, ElementGeometryChange, FeatureAppearance, FeatureAppearanceProvider, FeatureOverrides, GeometryClass,
  ModelGeometryChanges, TileProps, TileTreeProps, ViewFlagOverrides,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { InteractiveEditingSession } from "../InteractiveEditingSession";
import { RenderSystem } from "../render/RenderSystem";
import { IModelTile, IModelTileParams, iModelTileParamsFromJSON, Tile, TileContent, TileDrawArgs, TileLoadPriority, TileParams, TileRequest, TileTree, TileTreeParams } from "./internal";

/** @internal */
export interface IModelTileTreeOptions {
  readonly allowInstancing: boolean;
  readonly edgesRequired: boolean;
  readonly batchType: BatchType;
  readonly is3d: boolean;
}

// Overrides nothing.
const viewFlagOverrides = new ViewFlagOverrides();

/** Parameters used to construct an [[IModelTileTree]]
 * @internal
 */
export interface IModelTileTreeParams extends TileTreeParams {
  rootTile: TileProps;
  contentIdQualifier?: string;
  geometryGuid?: string;
  maxInitialTilesToSkip?: number;
  formatVersion?: number;
  options: IModelTileTreeOptions;
}

/** @internal */
export function iModelTileTreeParamsFromJSON(props: TileTreeProps, iModel: IModelConnection, modelId: Id64String, geometryGuid: string | undefined, options: IModelTileTreeOptions): IModelTileTreeParams {
  const location = Transform.fromJSON(props.location);
  const { formatVersion, id, rootTile, contentIdQualifier, maxInitialTilesToSkip } = props;

  let contentRange;
  if (undefined !== props.contentRange)
    contentRange = Range3d.fromJSON<ElementAlignedBox3d>(props.contentRange);

  const priority = BatchType.Primary === options.batchType ? TileLoadPriority.Primary : TileLoadPriority.Classifier;
  return { formatVersion, id, rootTile, iModel, location, modelId, contentRange, geometryGuid, contentIdQualifier, maxInitialTilesToSkip, priority, options };
}

function findElementChangesForModel(changes: Iterable<ModelGeometryChanges>, modelId: Id64String): Iterable<ElementGeometryChange>| undefined {
  for (const change of changes)
    if (change.id === modelId)
      return change.elements;

  return undefined;
}

/** Hides elements within static tiles if they have been modified during the current editing session.
 * Those elements are instead drawn as individual "tiles" in the dynamic branch of the [[RootTile]].
 */
class StaticAppearanceProvider implements FeatureAppearanceProvider {
  public readonly hiddenElements = new Id64.Uint32Set();

  public getFeatureAppearance(overrides: FeatureOverrides, elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number): FeatureAppearance | undefined {
    return this.hiddenElements.has(elemLo, elemHi) ? undefined : overrides.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }
}

/** No interactive editing session is currently active. */
class StaticState {
  public readonly type = "static";
  public readonly dispose: () => void;

  public constructor(root: RootTile) {
    this.dispose = InteractiveEditingSession.onBegin.addOnce((session: InteractiveEditingSession) => {
      root.transition(new InteractiveState(session, root));
    });
  }
}

/** An interactive editing session is currently active, but no elements in the tile tree's model have been modified. */
class InteractiveState {
  public readonly type = "interactive";
  public readonly dispose: () => void;

  public constructor(session: InteractiveEditingSession, root: RootTile) {
    const removeEndingListener = session.onEnding.addOnce((_) => {
      root.transition(new StaticState(root));
    });

    const removeGeomListener = session.onGeometryChanges.addListener((changes: Iterable<ModelGeometryChanges>, _session: InteractiveEditingSession) => {
      assert(session === _session);
      const elemChanges = findElementChangesForModel(changes, root.tree.modelId);
      if (elemChanges)
        root.transition(new DynamicState(root, elemChanges, session));
    });

    this.dispose = () => {
      removeEndingListener();
      removeGeomListener();
    };
  }
}

/** Elements in the tile tree's model have been modified during the current interactive editing session. */
class DynamicState {
  public readonly type = "dynamic";
  public readonly appearanceProvider = new StaticAppearanceProvider();
  private readonly _dispose: () => void;

  public dispose(): void {
    this._dispose();
    // ###TODO tiles etc
  }

  public constructor(root: RootTile, elemChanges: Iterable<ElementGeometryChange>, session: InteractiveEditingSession) {
    this.addChanges(elemChanges);

    // ###TODO tiles etc

    const removeEndingListener = session.onEnding.addOnce((_) => {
      root.transition(new StaticState(root));
    });

    const removeGeomListener = session.onGeometryChanges.addListener((changes: Iterable<ModelGeometryChanges>, _session: InteractiveEditingSession) => {
      assert(session === _session);
      const elems = findElementChangesForModel(changes, root.tree.modelId);
      if (elems)
        this.addChanges(elems);
    });

    this._dispose = () => {
      removeEndingListener();
      removeGeomListener();
    };
  }

  private addChanges(changes: Iterable<ElementGeometryChange>): void {
    for (const change of changes)
      if (change.type !== DbOpcode.Insert)
        this.appearanceProvider.hiddenElements.addId(change.id);

    // ###TODO update tiles, ranges, etc.
  }
}

/** The tile tree has been disposed. */
class DisposedState {
  public readonly type = "disposed";
  public dispose(): void { }
}

const disposedState = new DisposedState();

/** The current state of an [[IModelTileTree]]'s [[RootTile]]. The tile transitions between these states primarily in response to InteractiveEditingSession events. */
type RootTileState = StaticState | InteractiveState | DynamicState | DisposedState;

/** Represents the root [[Tile]] of an [[IModelTileTree]]. The root tile has one or two direct child tiles which represent different branches of the tree:
 *  - The static branch, containing tiles that represent the state of the model's geometry as of the beginning of the current [[InteractiveEditingSession]].
 *  - The dynamic branch, containing tiles representing the geometry of elements that have been modified during the current [[InteractiveEditingSession]].
 * If no editing session is currently active, the dynamic branch does not exist, and the static branch represents the current state of all elements in the model.
 */
class RootTile extends Tile {
  private readonly _staticRoot: IModelTile;
  private _tileState: RootTileState;

  public constructor(params: IModelTileParams, tree: IModelTileTree) {
    const rootParams: TileParams = {
      ...params,
      isLeaf: false,
      contentId: "",
    };

    super(rootParams, tree);
    this._staticRoot = new IModelTile(params, tree);
    this.setIsReady();

    // Determine initial state.
    const session = InteractiveEditingSession.get(tree.iModel);
    if (!session) {
      this._tileState = new StaticState(this);
    } else {
      const changes = session.getGeometryChangesForModel(tree.modelId);
      this._tileState = changes ? new DynamicState(this, changes, session) : new InteractiveState(session, this);
    }

    // Load the children immediately.
    this.loadChildren();
  }

  public dispose(): void {
    super.dispose();
    this._tileState.dispose();
    this._tileState = disposedState;
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    const children: Tile[] = [ this._staticRoot ];
    // ###TODO if (this._dynamicRoot)
    //   children.push(this._dynamicRoot); Will need to add dynamic root tile to children when session starts.

    resolve(children);
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    assert(false, "Root iModel tile has no content");
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    throw new Error("Root iModel tile has no content");
  }

  public selectTiles(args: TileDrawArgs): Tile[] {
    const tiles: Tile[] = [];
    this._staticRoot.selectTiles(tiles, args, 0);
    // ###TODO this._dynamicRoot.selectTiles(tiles, args);
    return tiles;
  }

  public draw(args: TileDrawArgs): void {
    // Draw the static tiles, hiding any elements present in the dynamic tiles.
    if ("dynamic" === this._tileState.type)
      args.appearanceProvider = this._tileState.appearanceProvider;

    const tiles: Tile[] = [];
    this._staticRoot.selectTiles(tiles, args, 0);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
    args.appearanceProvider = undefined;
    if ("dynamic" !== this._tileState.type)
      return;

    // Draw the dynamic tiles.
    args.graphics.clear();
    tiles.length = 0;
    // ###TODO: this._dynamicRoot.selectTiles(tiles, args);
    // for (const tile of tiles)
    //   tile.drawGraphics(args);

    // args.drawGraphics();
  }

  public prune(expirationTime: BeDuration): void {
    const olderThan = BeTimePoint.now().minus(expirationTime);
    this._staticRoot.pruneChildren(olderThan);
    // ###TODO prune dynamic tiles
  }

  public transition(newState: RootTileState): void {
    this._tileState.dispose();
    this._tileState = newState;
  }
}

/** A TileTree whose contents are derived from geometry stored in a Model in an IModelDb.
 * @internal
 */
export class IModelTileTree extends TileTree {
  private readonly _rootTile: RootTile;
  private readonly _options: IModelTileTreeOptions;
  public readonly contentIdQualifier?: string;
  public readonly geometryGuid?: string;
  public readonly maxTilesToSkip: number;
  public readonly maxInitialTilesToSkip: number;
  public readonly contentIdProvider: ContentIdProvider;
  /** Strictly for debugging/testing - forces tile selection to halt at the specified depth. */
  public debugMaxDepth?: number;

  public constructor(params: IModelTileTreeParams) {
    super(params);
    this.contentIdQualifier = params.contentIdQualifier;
    this.geometryGuid = params.geometryGuid;

    this.maxInitialTilesToSkip = params.maxInitialTilesToSkip ?? 0;
    this.maxTilesToSkip = IModelApp.tileAdmin.maximumLevelsToSkip;

    this._options = params.options;

    this.contentIdProvider = ContentIdProvider.create(params.options.allowInstancing, IModelApp.tileAdmin, params.formatVersion);

    params.rootTile.contentId = this.contentIdProvider.rootContentId;
    this._rootTile = new RootTile(iModelTileParamsFromJSON(params.rootTile, undefined), this);
  }

  public get maxDepth() { return 32; }
  public get rootTile(): Tile { return this._rootTile; }
  public get is3d() { return this._options.is3d; }
  public get isContentUnbounded() { return false; }
  public get viewFlagOverrides() { return viewFlagOverrides; }

  public get batchType(): BatchType { return this._options.batchType; }
  public get hasEdges(): boolean { return this._options.edgesRequired; }

  protected _selectTiles(args: TileDrawArgs): Tile[] {
    return this._rootTile.selectTiles(args);
  }

  public draw(args: TileDrawArgs): void {
    const tiles = this.selectTiles(args);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
  }

  public prune(): void {
    this._rootTile.prune(this.expirationTime);
  }
}
