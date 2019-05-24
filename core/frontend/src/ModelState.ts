/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { dispose, Id64, Id64String, JsonUtils, IModelStatus } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { BatchType, GeometricModel2dProps, ModelProps, RelatedElement, TileTreeProps } from "@bentley/imodeljs-common";
import { EntityState } from "./EntityState";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelTile } from "./tile/IModelTile";
import { RealityModelTileTree } from "./tile/RealityModelTileTree";
import { TileTree, TileTreeState } from "./tile/TileTree";

/** Represents the front-end state of a [Model]($backend).
 * @public
 */
export class ModelState extends EntityState implements ModelProps {
  /** @internal */
  public static get className() { return "Model"; }
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public parentModel: Id64String;
  public readonly isPrivate: boolean;
  public readonly isTemplate: boolean;

  constructor(props: ModelProps, iModel: IModelConnection) {
    super(props, iModel);
    this.modeledElement = RelatedElement.fromJSON(props.modeledElement)!;
    this.name = props.name ? props.name : "";
    this.parentModel = Id64.fromJSON(props.parentModel)!; // NB! Must always match the model of the modeledElement!
    this.isPrivate = JsonUtils.asBool(props.isPrivate);
    this.isTemplate = JsonUtils.asBool(props.isTemplate);
  }

  /** Add all custom-handled properties of a Model to a json object. */
  public toJSON(): ModelProps {
    const val = super.toJSON() as ModelProps;
    val.modeledElement = this.modeledElement;
    val.parentModel = this.parentModel;
    val.name = this.name;
    if (this.isPrivate)
      val.isPrivate = this.isPrivate;
    if (this.isTemplate)
      val.isTemplate = this.isTemplate;
    return val;
  }

  /** Determine whether this is a GeometricModel */
  public get isGeometricModel(): boolean { return false; }

  /** Attempts to cast this model to a geometric model. */
  public get asGeometricModel(): GeometricModelState | undefined { return undefined; }
  /** Attempts to cast this model to a 3d geometric model. */
  public get asGeometricModel3d(): GeometricModel3dState | undefined { return undefined; }
  /** Attempts to cast this model to a 2d geometric model. */
  public get asGeometricModel2d(): GeometricModel2dState | undefined { return undefined; }

  /** Executes just before the containing IModelConnection is closed to perform any necessary cleanup.
   * @internal
   */
  public onIModelConnectionClose() { }
}

/** Interface adopted by an object which can supply a tile tree for display within a [[ViewState]].
 * Typically tile trees are obtained from geometric models, but they may also originate from display style settings
 * such as a background map provider or a set of "context" reality models not directly embedded into the iModel.
 * An application typically does not interact directly with tile trees; instead it interacts with a [[ViewState]] or [[Viewport]] which
 * coordinates with tile trees on its behalf.
 * @alpha
 */
export interface TileTreeModelState {
  /** If the tile tree is loaded, returns it.
   * @see [[load]]
   * @internal
   */
  readonly tileTree: TileTree | undefined;
  /** @internal */
  readonly loadStatus: TileTree.LoadStatus;
  /** @internal */
  readonly treeModelId: Id64String; // Model Id, or transient Id if not a model (context reality model)
  /** @internal */
  readonly jsonProperties: { [key: string]: any };
  /** @internal */
  readonly iModel: IModelConnection;
  /** If no attempt has yet been made to load the tile tree, enqueue it for asynchronous loading.
   * @param edgesRequired If true, the loaded tile tree will include graphics for edges of surfaces.
   * @param animationId The Id of the source animation node, if any.
   * @returns The current load status of the tile tree.
   * @note This function is *not* asynchronous, but may trigger an internal asynchronous operation.
   * @see [[TileTreeModelState.loadStatus]] to query the current state of the tile tree's loading operation.
   * @internal
   */
  loadTree(edgesRequired: boolean, animationId?: Id64String): TileTree.LoadStatus;
}

/** Represents the front-end state of a [GeometricModel]($backend).
 * The contents of a GeometricModelState can be rendered inside a [[Viewport]].
 * @public
 */
export abstract class GeometricModelState extends ModelState /* implements TileTreeModelState */ {
  /** @internal */
  public static get className() { return "GeometricModel"; }

  private _modelRange?: Range3d;
  /** @internal */
  protected _tileTreeState: TileTreeState = new TileTreeState(this.iModel, !this.is2d, this.id);
  /** @internal */
  protected _classifierTileTreeState: TileTreeState = new TileTreeState(this.iModel, !this.is2d, this.id);

  /** Returns true if this is a 3d model (a [[GeometricModel3dState]]). */
  public abstract get is3d(): boolean;
  /** @internal */
  public get asGeometricModel(): GeometricModelState { return this; }
  /** Returns true if this is a 2d model (a [[GeometricModel2dState]]). */
  public get is2d(): boolean { return !this.is3d; }

  /** @internal */
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  /** @internal */
  public get classifierTileTree(): TileTree | undefined { return this._classifierTileTreeState.tileTree; }

  /** @internal */
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public set loadStatus(status: TileTree.LoadStatus) { this._tileTreeState.loadStatus = status; }

  /** @internal */
  public get isGeometricModel(): boolean { return true; }
  /** @internal */
  public get treeModelId(): Id64String { return this.id; }

  /** @internal */
  public loadTree(edgesRequired: boolean, animationId?: Id64String): TileTree.LoadStatus {
    // If this is a reality model, its tile tree is obtained from reality data service URL.
    if (undefined !== this.jsonProperties.tilesetUrl) {
      if (TileTree.LoadStatus.NotLoaded === this.loadStatus) {
        this.loadStatus = TileTree.LoadStatus.Loading;
        RealityModelTileTree.loadRealityModelTileTree(this.jsonProperties.tilesetUrl, this.jsonProperties.tilesetToDbTransform, this._tileTreeState);
      }

      return this.loadStatus;
    }

    return this.loadTileTree({ type: BatchType.Primary, edgesRequired, animationId });
  }

  /** @internal */
  public loadClassifierTileTree(type: BatchType.PlanarClassifier | BatchType.VolumeClassifier, expansion: number): TileTree.LoadStatus {
    return this.loadTileTree({ type, expansion });
  }

  /** @internal */
  public loadTileTree(treeId: IModelTile.TreeId): TileTree.LoadStatus {
    // Determine which tree we want, and invalidate if incompatible with supplied options.
    let state: TileTreeState;
    let allowInstancing = false;
    let batchType: BatchType;
    let edgesRequired = false;
    let animationId: Id64String | undefined;
    if (treeId.type === BatchType.Primary) {
      batchType = BatchType.Primary;
      edgesRequired = treeId.edgesRequired;
      animationId = treeId.animationId;
      state = this._tileTreeState;
      if ((edgesRequired && state.edgesOmitted) || animationId !== state.animationId)
        state.clearTileTree();

      if (undefined === treeId.animationId)
        allowInstancing = true;
    } else {
      state = this._classifierTileTreeState;
      batchType = treeId.type;
      if (state.classifierExpansion !== treeId.expansion) {
        state.clearTileTree();
        state.classifierExpansion = treeId.expansion;
      }
    }

    // If we've already tried to load, return current status.
    if (TileTree.LoadStatus.NotLoaded !== state.loadStatus)
      return state.loadStatus;

    // Enqueue the tree for loading.
    state.loadStatus = TileTree.LoadStatus.Loading;

    const id = IModelTile.treeIdToString(this.id, treeId);
    this.iModel.tiles.getTileTreeProps(id).then((result: TileTreeProps) => {
      const loader = new IModelTile.Loader(this.iModel, result.formatVersion, batchType, edgesRequired, allowInstancing);
      result.rootTile.contentId = loader.rootContentId;
      state.setTileTree(result, loader);

      state.edgesOmitted = !edgesRequired;
      state.animationId = animationId;

      IModelApp.viewManager.onNewTilesReady();
    }).catch((err) => {
      // Retry in case of timeout; otherwise fail.
      if (err.errorNumber && err.errorNumber === IModelStatus.ServerTimeout)
        state.loadStatus = TileTree.LoadStatus.NotLoaded;
      else
        state.loadStatus = TileTree.LoadStatus.NotFound;

      IModelApp.viewManager.onNewTilesReady();
    });

    return state.loadStatus;
  }

  /** @internal */
  public onIModelConnectionClose() {
    dispose(this._tileTreeState.tileTree);  // we do not track if we are disposed...catch this at the tileTree level
    super.onIModelConnectionClose();
  }

  /** Query for the union of the ranges of all the elements in this GeometricModel. */
  public async queryModelRange(): Promise<Range3d> {
    if (undefined === this._modelRange) {
      const ranges = await this.iModel.models.queryModelRanges(this.id);
      this._modelRange = Range3d.fromJSON(ranges[0]);
    }
    return this._modelRange!;
  }
}

/** Represents the front-end state of a [GeometricModel2d]($backend).
 * @public
 */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  /** @internal */
  public static get className() { return "GeometricModel2d"; }
  /** @internal */
  public readonly globalOrigin: Point2d;

  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  /** @internal */
  public get is3d(): boolean { return false; }
  /** @internal */
  public get asGeometricModel2d(): GeometricModel2dState { return this; }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** Represents the front-end state of a [GeometricModel3d]($backend).
 * @public
 */
export class GeometricModel3dState extends GeometricModelState {
  /** @internal */
  public static get className() { return "GeometricModel3d"; }
  /** @internal */
  public get is3d(): boolean { return true; }
  /** @internal */
  public get asGeometricModel3d(): GeometricModel3dState { return this; }
}

/** Represents the front-end state of a [SheetModel]($backend).
 * @public
 */
export class SheetModelState extends GeometricModel2dState {
  /** @internal */
  public static get className() { return "SheetModel"; }
}

/** Represents the front-end state of a [SpatialModel]($backend).
 * @public
 */
export class SpatialModelState extends GeometricModel3dState {
  /** @internal */
  public static get className() { return "SpatialModel"; }
}

/** Represents the front-end state of a [PhysicalModel]($backend).
 * @public
 */
export class PhysicalModelState extends SpatialModelState {
  /** @internal */
  public static get className() { return "PhysicalModel"; }
}

/** Represents the front-end state of a [SpatialLocationModel]($backend).
 * @public
 */
export class SpatialLocationModelState extends SpatialModelState {
  /** @internal */
  public static get className() { return "SpatialLocationModel"; }
}

/** Represents the front-end state of a [DrawingModel]($backend).
 * @public
 */
export class DrawingModelState extends GeometricModel2dState {
  /** @internal */
  public static get className() { return "DrawingModel"; }
}

/** Represents the front-end state of a [SectionDrawingModel]($backend).
 * @public
 */
export class SectionDrawingModelState extends DrawingModelState {
  /** @internal */
  public static get className() { return "SectionDrawingModel"; }
}
