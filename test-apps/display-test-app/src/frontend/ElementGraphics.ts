/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeTimePoint, ByteStream, compareStrings, Id64Set, Id64String, partitionArray, SortedArray } from "@itwin/core-bentley";
import { Range3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, ContentFlags, CurrentImdlVersion, ElementGraphicsRequestProps, Frustum, FrustumPlanes, Placement3d, QueryRowFormat, TileFormat, ViewFlagOverrides,
} from "@itwin/core-common";
import {
  ImdlReader, IModelApp, IModelConnection, RenderSystem, Tile, TileContent, TiledGraphicsProvider, TileDrawArgs, TileLoadPriority, TileParams,
  TileRequest, TileRequestChannel, TileTree, TileTreeParams, TileTreeReference, TileTreeSupplier, Tool, Viewport,
} from "@itwin/core-frontend";
import { parseToggle } from "@itwin/frontend-devtools";

function* makeIdSequence() {
  let current = 0;
  while (true) {
    if (current >= Number.MAX_SAFE_INTEGER)
      current = 0;

    yield ++current;
  }
}

const requestIdSequence = makeIdSequence();

interface ElementNode {
  readonly elementId: Id64String;
  readonly modelId: Id64String;
  readonly categoryId: Id64String;
  readonly aabb: Range3d;
  tile?: ElementTile;
}

class ElementTile extends Tile {
  private _dispose?: () => undefined;

  public constructor(parent: Tile, node: ElementNode) {
    super({
      parent,
      isLeaf: true,
      contentId: node.elementId,
      range: node.aabb,
      maximumSize: 2048,
    }, parent.tree);

    this._dispose = () => node.tile = undefined;
  }

  public override disposeContents(): void {
    if (this._dispose)
      this._dispose = this._dispose();

    super.disposeContents();
  }

  public override computeLoadPriority(): number {
    return 0;
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    resolve(undefined);
  }

  public get channel(): TileRequestChannel {
    return IModelApp.tileAdmin.channels.elementGraphicsRpc;
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    const requestId = requestIdSequence.next();
    assert(!requestId.done);

    const props: ElementGraphicsRequestProps = {
      id: requestId.value.toString(16),
      elementId: this.contentId,
      toleranceLog10: -2,
      formatVersion: CurrentImdlVersion.Major,
      location: this.tree.iModelTransform.toJSON(),
      omitEdges: false,
      clipToProjectExtents: true,
      // sectionCut: this.tree.stringifiedSectionClip,
      contentFlags: ContentFlags.AllowInstancing | ContentFlags.ImprovedElision | ContentFlags.ExternalTextures,
    };

    return IModelApp.tileAdmin.requestElementGraphics(this.tree.iModel, props);
  }

  public async readContent(data: TileRequest.ResponseData, system: RenderSystem, isCanceled: () => boolean): Promise<TileContent> {
    isCanceled = isCanceled ?? (() => !this.isLoading);
    assert(data instanceof Uint8Array);
    const stream = ByteStream.fromUint8Array(data);
    const pos = stream.curPos;
    const format = stream.nextUint32;
    assert(TileFormat.IModel === format);
    stream.curPos = pos;

    const tree = this.tree;
    const containsTransformNodes = false;
    const { iModel, modelId, is3d /*, containsTransformNodes */ } = tree;
    const reader = ImdlReader.create({
      stream, iModel, modelId, is3d, system, isCanceled, containsTransformNodes,
      type: BatchType.Primary, // tree.batchType,
      loadEdges: true,
      options: { tileId: this.contentId },
    });

    let content: TileContent = { isLeaf: true };
    if (reader) {
      try {
        content = await reader.read();
      } catch {
        //
      }
    }

    return content;
  }
}

class ElementTiles extends SortedArray<ElementTile> {
  public constructor() {
    super((lhs, rhs) => compareStrings(lhs.contentId, rhs.contentId));
  }

  public get array(): ElementTile[] {
    return this._array;
  }
}

class RootTile extends Tile {
  private readonly _elementTiles;

  public constructor(tree: TileTree) {
    const params: TileParams = {
      isLeaf: false,
      contentId: "elements",
      range: Range3d.createNull(),
      maximumSize: 2048,
    };

    super(params, tree);
    this._elementTiles = new ElementTiles();
    this.loadChildren();
    assert(undefined !== this.children);
    assert(this.children === this._elementTiles.array);

    this.setIsReady();
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    resolve(this._elementTiles.array);
  }

  public get channel(): TileRequestChannel {
    throw new Error("Root dynamic tile has no content");
  }

  public async requestContent(): Promise<TileRequest.Response> {
    throw new Error("Root dynamic tile has no content");
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    throw new Error("Root dynamic tile has no content");
  }
}

interface ElementsCriteria {
  models: Id64Set;
  categories: Id64Set;
  args: TileDrawArgs;
}

interface ElementsSource {
  getElements(criteria: ElementsCriteria): Iterable<ElementNode>;
}

class Tree extends TileTree {
  private readonly _rootTile: RootTile;
  private readonly _source: ElementsSource;

  public constructor(source: ElementsSource, params: TileTreeParams) {
    super(params);
    this._rootTile = new RootTile(this);
    this._source = source;
  }

  public override get rootTile() { return this._rootTile; }
  public override get is3d() { return true; }
  public override get maxDepth() { return 2; }
  public override get viewFlagOverrides(): ViewFlagOverrides { return { }; }

  protected override _selectTiles(args: TileDrawArgs): Tile[] {
    const view = args.viewingSpace.view;
    if (!view.isSpatialView())
      return [];

    const elements = this._source.getElements({
      models: view.modelSelector.models,
      categories: view.categorySelector.categories,
      args,
    });

    const tiles: Tile[] = [];
    for (const element of elements) {
      if (!element.tile)
        element.tile = new ElementTile(this.rootTile, element);

      if (!element.tile.isReady)
        args.insertMissing(element.tile);
      else if (element.tile.hasGraphics)
        tiles.push(element.tile);
    }

    return tiles;
  }

  public override draw(args: TileDrawArgs): void {
    const tiles = this.selectTiles(args);
    for (const tile of tiles)
      tile.drawGraphics(args);

    args.drawGraphics();
  }

  public override prune(): void {
  }
}

class NaiveElementsSource implements ElementsSource {
  private readonly _elements: ElementNode[];

  private constructor(elements: ElementNode[]) {
    this._elements = elements;
  }

  public getElements(criteria: ElementsCriteria): Iterable<ElementNode> {
    // ###TODO take into account feature symbology overrides that cause individual elements to always/never draw
    return this._elements.filter((x) => {
      if (!criteria.models.has(x.modelId) || !criteria.categories.has(x.categoryId))
        return false;

      // ###TODO frustum tests are not working...
      const testFrustum = false;
      if (!testFrustum)
        return true;

      const frustum = Frustum.fromRange(x.aabb, scratchFrustum);
      return FrustumPlanes.Containment.Outside !== criteria.args.frustumPlanes.computeFrustumContainment(frustum);
    });
  }

  public static async create(iModel: IModelConnection): Promise<ElementsSource> {
    const ecsql = `
      SELECT ECInstanceId, Model.Id, Category.Id, BBoxLow, BBoxHigh, Origin, Yaw, Pitch, Roll
      FROM bis.SpatialElement
      WHERE GeometryStream IS NOT NULL
    `;

    const nodes: ElementNode[] = [];
    for await (const row of iModel.query(ecsql, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes })) {
      const placement = Placement3d.fromJSON({
        origin: row[5],
        angles: { yaw: row[6], pitch: row[7], roll: row[8] },
        // ECSql gives upper-case coordinates, core-geometry wants lower-case...
        bbox: {
          low: { x: row[3].X, y: row[3].Y, z: row[3].Z, },
          high: { x: row[4].X, y: row[4].Y, z: row[4].Z },
        },
      });

      nodes.push({
        elementId: row[0],
        modelId: row[1],
        categoryId: row[2],
        aabb: placement.calculateRange(),
      });
    }

    return new NaiveElementsSource(nodes);
  }
}

class Supplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: Provider, rhs: Provider): number {
    return lhs.providerId - rhs.providerId;
  }

  public async createTileTree(provider: Provider, iModel: IModelConnection): Promise<TileTree | undefined> {
    assert(provider.iModel === iModel);
    const source = await NaiveElementsSource.create(iModel);
    const params: TileTreeParams = {
      iModel,
      id: `ElemGfx_${provider.providerId.toString()}`,
      modelId: "0",
      location: Transform.createIdentity(), // ###TODO center of project extents
      priority: TileLoadPriority.Primary,
    };

    return new Tree(source, params);
  }
}

const supplier = new Supplier();

class Reference extends TileTreeReference {
  public constructor(private readonly _provider: Provider) {
    super();
  }

  public get treeOwner() {
    return this._provider.iModel.tiles.getTileTreeOwner(this._provider, supplier);
  }
}

const scratchFrustum = new Frustum();

class Provider implements TiledGraphicsProvider {
  private static _nextId = 1;
  public readonly providerId: number;
  public readonly iModel: IModelConnection;
  private readonly _ref: Reference;

  private constructor(iModel: IModelConnection) {
    this.iModel = iModel;
    this.providerId = Provider._nextId++;
    this._ref = new Reference(this);
  }

  public forEachTileTreeRef(_viewport: Viewport, func: (ref: TileTreeReference) => void): void {
    func(this._ref);
  }

  public static async registerProvider(viewport: Viewport): Promise<void> {
    if (!viewport.view.isSpatialView())
      return;

    const provider = new Provider(viewport.iModel);
    viewport.addTiledGraphicsProvider(provider);

    const iModel = viewport.view.iModel;
    viewport.onChangeView.addListener(() => {
      if (viewport.view.iModel !== iModel || !viewport.view.isSpatialView())
        viewport.dropTiledGraphicsProvider(provider);
    });
  }
}

export class ToggleElementGraphicsTool extends Tool {
  public static override toolId = "ToggleElementGraphics";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(enable?: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.isSpatialView())
      return false;

    let provider;
    for (const p of vp.tiledGraphicsProviders) {
      if (p instanceof Provider) {
        provider = p;
        break;
      }
    }

    if (undefined === enable)
      enable = undefined === provider;

    if (enable) {
      if (!provider)
        await Provider.registerProvider(vp);
    } else if (provider) {
      vp.dropTiledGraphicsProvider(provider);
    }

    return true;
  }

  public override parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      return this.run(enable);

    return Promise.resolve(false);
  }
}
