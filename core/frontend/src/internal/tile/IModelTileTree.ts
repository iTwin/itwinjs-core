/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeTimePoint, DbOpcode, GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, ContentIdProvider, EdgeOptions, ElementAlignedBox3d, ElementGeometryChange, FeatureAppearanceProvider,
  IModelTileTreeId, IModelTileTreeProps, ModelGeometryChanges, RenderSchedule, TileProps
} from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { GraphicalEditingScope } from "../../GraphicalEditingScope";
import { RenderSystem } from "../../render/RenderSystem";
import { GraphicBranch } from "../../render/GraphicBranch";
import {
  acquireImdlDecoder, DynamicIModelTile, ImdlDecoder, IModelTile, IModelTileParams, iModelTileParamsFromJSON, LayerTileTreeHandler, MapLayerTreeSetting, Tile,
  TileContent, TileDrawArgs, TileLoadPriority, TileParams, TileRequest, TileRequestChannel, TileTree, TileTreeParams
} from "../../tile/internal";

export interface IModelTileTreeOptions {
  readonly allowInstancing: boolean;
  readonly edges: EdgeOptions | false;
  readonly batchType: BatchType;
  readonly is3d: boolean;
  timeline: RenderSchedule.ModelTimeline | undefined;
}

// Overrides nothing.
const viewFlagOverrides = {};

/** Parameters used to construct an [[IModelTileTree]]
 */
export interface IModelTileTreeParams extends TileTreeParams {
  rootTile: TileProps;
  contentIdQualifier?: string;
  geometryGuid?: GuidString;
  maxInitialTilesToSkip?: number;
  formatVersion?: number;
  tileScreenSize: number;
  options: IModelTileTreeOptions;
  transformNodeRanges?: Map<number, Range3d>;
}

export function iModelTileTreeParamsFromJSON(props: IModelTileTreeProps, iModel: IModelConnection, modelId: Id64String, options: IModelTileTreeOptions): IModelTileTreeParams {
  const location = Transform.fromJSON(props.location);
  const { formatVersion, id, rootTile, contentIdQualifier, maxInitialTilesToSkip, geometryGuid } = props;
  const tileScreenSize = props.tileScreenSize ?? 512;

  let contentRange;
  if (undefined !== props.contentRange)
    contentRange = Range3d.fromJSON<ElementAlignedBox3d>(props.contentRange);

  let transformNodeRanges;
  if (props.transformNodeRanges) {
    transformNodeRanges = new Map<number, Range3d>();
    for (const entry of props.transformNodeRanges)
      transformNodeRanges.set(entry.id, Range3d.fromJSON(entry));
  }

  const priority = BatchType.Primary === options.batchType ? TileLoadPriority.Primary : TileLoadPriority.Classifier;
  return {
    formatVersion,
    id,
    rootTile,
    iModel,
    location,
    modelId,
    contentRange,
    geometryGuid,
    contentIdQualifier,
    maxInitialTilesToSkip,
    priority,
    options,
    tileScreenSize,
    transformNodeRanges,
  };
}

function findElementChangesForModel(changes: Iterable<ModelGeometryChanges>, modelId: Id64String): Iterable<ElementGeometryChange> | undefined {
  for (const change of changes)
    if (change.id === modelId)
      return change.elements;

  return undefined;
}

/** No graphical editing scope is currently active. */
class StaticState {
  public readonly type = "static";
  public readonly [Symbol.dispose]!: () => void;

  public constructor(root: RootTile) {
    this[Symbol.dispose] = GraphicalEditingScope.onEnter.addOnce((scope: GraphicalEditingScope) => {
      root.transition(new InteractiveState(scope, root));
    });
  }
}

/** A graphical editing scope is currently active, but no elements in the tile tree's model have been modified. */
class InteractiveState {
  public readonly type = "interactive";
  public readonly [Symbol.dispose]!: () => void;

  public constructor(scope: GraphicalEditingScope, root: RootTile) {
    const removeEndingListener = scope.onExiting.addOnce((_) => {
      root.transition(new StaticState(root));
    });

    const removeGeomListener = scope.onGeometryChanges.addListener((changes: Iterable<ModelGeometryChanges>, _scope: GraphicalEditingScope) => {
      assert(scope === _scope);
      const elemChanges = findElementChangesForModel(changes, root.tree.modelId);
      if (elemChanges)
        root.transition(new DynamicState(root, elemChanges, scope));
    });

    this[Symbol.dispose] = () => {
      removeEndingListener();
      removeGeomListener();
    };
  }
}

/** Elements in the tile tree's model have been modified during the current editing scope. */
class DynamicState {
  public readonly type = "dynamic";
  public readonly rootTile: DynamicIModelTile;
  private readonly _dispose: () => void;

  public [Symbol.dispose](): void {
    this._dispose();
    this.rootTile[Symbol.dispose]();
  }

  public constructor(root: RootTile, elemChanges: Iterable<ElementGeometryChange>, scope: GraphicalEditingScope) {
    this.rootTile = DynamicIModelTile.create(root, elemChanges);

    const removeEndingListener = scope.onExiting.addOnce((_) => {
      root.transition(new StaticState(root));
    });

    const removeGeomListener = scope.onGeometryChanges.addListener((changes: Iterable<ModelGeometryChanges>, _scope: GraphicalEditingScope) => {
      assert(scope === _scope);
      const elems = findElementChangesForModel(changes, root.tree.modelId);
      if (elems)
        this.rootTile.handleGeometryChanges(elems);
    });

    this._dispose = () => {
      removeEndingListener();
      removeGeomListener();
    };
  }
}

class ScheduleScriptDynamicState {
  public readonly type = "dynamic";
  public readonly rootTile: DynamicIModelTile;
  private _dispose: () => void;

  public [Symbol.dispose](): void {
    this._dispose();
    this.rootTile[Symbol.dispose]();
  }

  public constructor(root: RootTile, elemChanges: Iterable<ElementGeometryChange>) {
    this.rootTile = DynamicIModelTile.create(root, elemChanges);
    this._dispose = () => {};
  }
}

/** The tile tree has been disposed. */
class DisposedState {
  public readonly type = "disposed";
  public [Symbol.dispose](): void { }
}

const disposedState = new DisposedState();

/** The current state of an [[IModelTileTree]]'s [[RootTile]]. The tile transitions between these states primarily in response to GraphicalEditingScope events. */
type RootTileState = StaticState | InteractiveState | DynamicState | DisposedState | ScheduleScriptDynamicState ;

/** The root tile for an [[IModelTileTree]].
 */
export type RootIModelTile = Tile & { tileScreenSize: number, updateDynamicRange: (childTile: Tile) => void };

/** Represents the root [[Tile]] of an [[IModelTileTree]]. The root tile has one or two direct child tiles which represent different branches of the tree:
 *  - The static branch, containing tiles that represent the state of the model's geometry as of the beginning of the current [[GraphicalEditingScope]].
 *  - The dynamic branch, containing tiles representing the geometry of elements that have been modified during the current [[GraphicalEditingScope]].
 * If no editing scope is currently active, the dynamic branch does not exist, and the static branch represents the current state of all elements in the model.
 */
class RootTile extends Tile {
  public readonly staticBranch: IModelTile;
  private _tileState: RootTileState;
  private readonly _staticTreeContentRange?: Range3d;

  public get tileState(): RootTileState {
    return this._tileState;
  }

  public constructor(params: IModelTileParams, tree: IModelTileTree) {
    const rootParams: TileParams = {
      ...params,
      range: params.range.clone(),
      contentRange: params.contentRange?.clone(),
      isLeaf: false,
      contentId: "",
    };

    super(rootParams, tree);
    this.staticBranch = new IModelTile(params, tree);
    this._staticTreeContentRange = tree.contentRange?.clone();

    if (!this._contentRange)
      this._contentRange = this.staticBranch.contentRange.clone();

    // Determine initial state.
    const scope = tree.iModel.isBriefcaseConnection() ? tree.iModel.editingScope : undefined;
    if (undefined === scope) {
      this._tileState = new StaticState(this);
    } else {
      const changes = scope.getGeometryChangesForModel(tree.modelId);
      this._tileState = changes ? new DynamicState(this, changes, scope) : new InteractiveState(scope, this);
    }

    // Load the children immediately.
    this.setIsReady();
    this.loadChildren();
  }

  public override[Symbol.dispose](): void {
    this.transition(disposedState);
    super[Symbol.dispose]();
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    const children: Tile[] = [this.staticBranch];
    if (this._tileState.type === "dynamic")
      children.push(this._tileState.rootTile);

    resolve(children);
  }

  public get channel(): TileRequestChannel {
    throw new Error("Root iModel tile has no content");
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    assert(false, "Root iModel tile has no content");
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    throw new Error("Root iModel tile has no content");
  }

  public draw(args: TileDrawArgs, tiles: Tile[], numStaticTiles: number): void {
    assert(numStaticTiles >= 0 && numStaticTiles <= tiles.length);

    // Draw the static tiles.
    for (let i = 0; i < numStaticTiles; i++)
      tiles[i].drawGraphics(args);

    if ("dynamic" !== this._tileState.type || numStaticTiles === tiles.length) {
      if ("dynamic" === this._tileState.type)
        args.addAppearanceProvider(this._tileState.rootTile.appearanceProvider);

      args.drawGraphics();
      return;
    }

    // We need to hide any modified elements in the static tiles. Pull their graphics into a separate branch.
    if (!args.graphics.isEmpty) {
      const staticBranch = new GraphicBranch();
      for (const staticGraphic of args.graphics.entries)
        staticBranch.add(staticGraphic);

      let appearanceProvider = this._tileState.rootTile.appearanceProvider;
      if (args.appearanceProvider)
        appearanceProvider = FeatureAppearanceProvider.chain(args.appearanceProvider, appearanceProvider);
      args.graphics.clear();
      args.graphics.add(args.context.createGraphicBranch(staticBranch, Transform.createIdentity(), { appearanceProvider }));
    }

    // Draw the dynamic tiles.
    for (let i = numStaticTiles; i < tiles.length; i++)
      tiles[i].drawGraphics(args);

    args.drawGraphics();
  }

  public prune(olderThan: BeTimePoint): void {
    this.staticBranch.pruneChildren(olderThan);
    if ("dynamic" === this._tileState.type)
      this._tileState.rootTile.pruneChildren(olderThan);
  }

  public transition(newState: RootTileState): void {
    assert(newState.type !== this._tileState.type);
    const resetRange = "dynamic" === this._tileState.type;

    assert(undefined !== this.children);
    if ("dynamic" === this._tileState.type) {
      assert(2 === this.children.length);
      this.children.pop();
    } else if ("dynamic" === newState.type) {
      assert(1 === this.children.length);
      this.children.push(newState.rootTile);
    }

    this._tileState[Symbol.dispose]();
    this._tileState = newState;

    if (resetRange)
      this.resetRange();
  }

  private resetRange(): void {
    this.staticBranch.range.clone(this.range);
    this.staticBranch.contentRange.clone(this._contentRange);

    if (this._staticTreeContentRange && this.tree.contentRange)
      this._staticTreeContentRange.clone(this.tree.contentRange);

  }

  public get tileScreenSize(): number {
    return this.staticBranch.iModelTree.tileScreenSize;
  }

  public updateDynamicRange(tile: Tile): void {
    this.resetRange();
    if (this._staticTreeContentRange && this.tree.contentRange && !tile.contentRange.isNull)
      this.tree.contentRange.extendRange(tile.contentRange);

    if (!tile.range.isNull)
      this.range.extendRange(tile.range);

    assert(undefined !== this._contentRange);
    if (!tile.contentRange.isNull)
      this._contentRange.extendRange(tile.contentRange);
  }
}

/** A TileTree whose contents are derived from geometry stored in a Model in an IModelDb.
 * @internal exported strictly for display-test-app until we remove CommonJS support.
 */
export class IModelTileTree extends TileTree {
  public decoder: ImdlDecoder;
  private readonly _rootTile: RootTile;
  private readonly _options: IModelTileTreeOptions;
  private readonly _transformNodeRanges?: Map<number, Range3d>;
  public readonly contentIdQualifier?: string;
  public readonly geometryGuid?: string;
  public readonly maxTilesToSkip: number;
  public readonly maxInitialTilesToSkip: number;
  public readonly contentIdProvider: ContentIdProvider;
  public readonly stringifiedSectionClip?: string;
  public readonly tileScreenSize: number;
  public readonly iModelTileTreeId: IModelTileTreeId;
  /** Strictly for debugging/testing - forces tile selection to halt at the specified depth. */
  public debugMaxDepth?: number;
  /** A little hacky...we must not override selectTiles(), but draw() needs to distinguish between static and dynamic tiles.
   * So _selectTiles() puts the static tiles first in the Tile[] array, and records the number of static tiles selected, to be
   * used by draw().
   */
  private _numStaticTilesSelected = 0;
  public layerImageryTrees: MapLayerTreeSetting[] = [];

  private readonly _layerHandler: LayerTileTreeHandler;
  public override get layerHandler() { return this._layerHandler; }

  public constructor(params: IModelTileTreeParams, treeId: IModelTileTreeId) {
    super(params);
    this.iModelTileTreeId = treeId;
    this.contentIdQualifier = params.contentIdQualifier;
    this.geometryGuid = params.geometryGuid;
    this.tileScreenSize = params.tileScreenSize;
    this._layerHandler = new LayerTileTreeHandler(this);

    if (BatchType.Primary === treeId.type)
      this.stringifiedSectionClip = treeId.sectionCut;

    this.maxInitialTilesToSkip = params.maxInitialTilesToSkip ?? 0;
    this.maxTilesToSkip = IModelApp.tileAdmin.maximumLevelsToSkip;

    this._options = params.options;
    this._transformNodeRanges = params.transformNodeRanges;

    this.contentIdProvider = ContentIdProvider.create(params.options.allowInstancing, IModelApp.tileAdmin, params.formatVersion);

    params.rootTile.contentId = this.contentIdProvider.rootContentId;
    this._rootTile = new RootTile(iModelTileParamsFromJSON(params.rootTile, undefined), this);

    this.decoder = acquireImdlDecoder({
      type: this.batchType,
      omitEdges: false === this.edgeOptions,
      timeline: this.timeline,
      iModel: this.iModel,
      batchModelId: this.modelId,
      is3d: this.is3d,
      containsTransformNodes: this.containsTransformNodes,
      noWorker: !IModelApp.tileAdmin.decodeImdlInWorker,
    });
  }

  public override[Symbol.dispose](): void {
    this.decoder.release();
    super[Symbol.dispose]();
  }

  public get maxDepth() { return 32; }
  public get rootTile(): Tile { return this._rootTile; }
  /** Exposed chiefly for tests. */
  public get staticBranch(): IModelTile { return this._rootTile.staticBranch; }
  public get is3d() { return this._options.is3d; }
  public override get isContentUnbounded() { return false; }
  public get viewFlagOverrides() { return viewFlagOverrides; }

  public get batchType(): BatchType { return this._options.batchType; }
  public get edgeOptions(): EdgeOptions | false { return this._options.edges; }
  public get timeline(): RenderSchedule.ModelTimeline | undefined { return this._options.timeline; }

  public override get loadPriority(): TileLoadPriority {
    // If the model has been modified, we want to prioritize keeping its graphics up to date.
    return this.tileState === "dynamic" ? TileLoadPriority.Dynamic : super.loadPriority;
  }

  protected _selectTiles(args: TileDrawArgs): Tile[] {
    args.markUsed(this._rootTile);
    const tiles: Tile[] = [];
    this._rootTile.staticBranch.selectTiles(tiles, args, 0);
    this._numStaticTilesSelected = tiles.length;

    if (this._rootTile.tileState.type === "dynamic")
      this._rootTile.tileState.rootTile.selectTiles(tiles, args);

    return tiles;
  }

  public draw(args: TileDrawArgs): void {
    const tiles = this.selectTiles(args);
    this._rootTile.draw(args, tiles, this._numStaticTilesSelected);
    if (args.shouldCollectClassifierGraphics)
      this._layerHandler.collectClassifierGraphics(args, tiles);
  }

  public prune(): void {
    const olderThan = BeTimePoint.now().minus(this.expirationTime);
    this._rootTile.prune(olderThan);
  }

  /** Exposed strictly for tests. */
  public get tileState(): "static" | "dynamic" | "interactive" | "disposed" {
    return this._rootTile.tileState.type;
  }

  /** Exposed strictly for tests. */
  public get hiddenElements(): Id64Array {
    const state = this._rootTile.tileState;
    return "dynamic" === state.type ? state.rootTile.hiddenElements : [];
  }

  public getTransformNodeRange(nodeId: number): Range3d | undefined {
    return this._transformNodeRanges?.get(nodeId);
  }

  public get containsTransformNodes(): boolean {
    return undefined !== this._transformNodeRanges;
  }

  public override async onScheduleEditingChanged(changes: RenderSchedule.EditingChanges[]): Promise<void> {
    const displayStyle = IModelApp.viewManager.selectedView?.displayStyle;
    const newScript = displayStyle?.scheduleScript;
    const scriptRef = newScript ? new RenderSchedule.ScriptReference(displayStyle.id, newScript) : undefined;
    const scriptInfo = IModelApp.tileAdmin.getScriptInfoForTreeId(this.modelId, scriptRef);

    if (scriptInfo?.timeline && this.timeline !== scriptInfo.timeline) {
      this.decoder = acquireImdlDecoder({
        type: this.batchType,
        omitEdges: this.edgeOptions === false,
        timeline: scriptInfo.timeline,
        iModel: this.iModel,
        batchModelId: this.modelId,
        is3d: this.is3d,
        containsTransformNodes: this.containsTransformNodes,
        noWorker: !IModelApp.tileAdmin.decodeImdlInWorker,
      });
      this._options.timeline = scriptInfo.timeline;
    }

    const relevantChange = changes.find((c) => c.timeline.modelId === this.modelId);
    if (!relevantChange || relevantChange.elements.size === 0)
      return;

    const elementIds = Array.from(relevantChange.elements);
    const placements = await this.iModel.elements.getPlacements(elementIds, {
      type: this.is3d ? "3d" : "2d",
    });

    if (placements.length === 0)
      return;

    const changedElements = placements.map((x) => {
      return {
        id: x.elementId,
        type: DbOpcode.Update,
        range: x.calculateRange(),
      }
    });

    if (changedElements.length === 0)
      return;

    if (this._rootTile.tileState.type === "dynamic") {
      this._rootTile.transition(new StaticState(this._rootTile));
    }
    this._rootTile.transition(new ScheduleScriptDynamicState(this._rootTile, changedElements));
  }

  public override onScheduleEditingCommitted() {
    if (this._rootTile.tileState.type !== "static")
      this._rootTile.transition(new StaticState(this._rootTile));
  }
}
