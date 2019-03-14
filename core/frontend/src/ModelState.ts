/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { dispose, Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { BatchType, GeometricModel2dProps, ModelProps, RelatedElement, ServerTimeoutError, TileTreeProps } from "@bentley/imodeljs-common";
import { EntityState } from "./EntityState";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelTile } from "./tile/IModelTile";
import { RealityModelTileTree } from "./tile/RealityModelTileTree";
import { TileTree, TileTreeState } from "./tile/TileTree";
import { Classification } from "./Classification";

/** Represents the front-end state of a [Model]($backend).
 * @public
 */
export class ModelState extends EntityState implements ModelProps {
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
 * @beta
 */
export interface TileTreeModelState {
  /** @internal */
  readonly tileTree: TileTree | undefined;
  /** @internal */
  readonly loadStatus: TileTree.LoadStatus;
  /** @internal */
  readonly treeModelId: Id64String;    // Model Id, or transient Id if not a model (context reality model)
  /** @internal */
  loadTileTree(batchType: BatchType, edgesRequired: boolean, animationId?: Id64String, classifierExpansion?: number): TileTree.LoadStatus;
}

/** Represents the front-end state of a [GeometricModel]($backend).
 * The contents of a GeometricModelState can be rendered inside a [[Viewport]].
 * @public
 */
export abstract class GeometricModelState extends ModelState implements TileTreeModelState {
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

  /** If this model's tile tree is loaded, returns it.
   * @see [[loadTileTree]]
   * @internal
   */
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  /** @internal */
  public get classifierTileTree(): TileTree | undefined { return this._classifierTileTreeState.tileTree; }

  /** The current status of this model's asynchronously-loaded tile tree.
   * @internal
   */
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public set loadStatus(status: TileTree.LoadStatus) { this._tileTreeState.loadStatus = status; }
  /** @internal */
  public get isGeometricModel(): boolean { return true; }
  /** @internal */
  public get treeModelId(): Id64String { return this.id; }

  /** Attempt to obtain this model's tile tree, enqueueing it for asynchronous loading if necessary.
   * @param edgesRequired If true, the loaded tile tree will include graphics for edges of surfaces.
   * @returns The tile tree if it is loaded, or undefined if it is currently loading or has failed to load.
   * @note This function is *not* asynchronous, but may trigger an internal asynchronous operation.
   * @see [[GeometricModelState.loadStatus]] to query the current state of the tile tree's loading operation.
   * @internal
   */
  public getOrLoadTileTree(batchType: BatchType, edgesRequired: boolean): TileTree | undefined {
    if (undefined === this.tileTree)
      this.loadTileTree(batchType, edgesRequired);

    return this.tileTree;
  }

  /** @see [[getOrLoadTileTree]]
   * @internal
   */
  public loadTileTree(batchType: BatchType, edgesRequired: boolean, animationId?: Id64String, classifierExpansion?: number): TileTree.LoadStatus {
    const asClassifier = (BatchType.VolumeClassifier === batchType || BatchType.PlanarClassifier === batchType);
    const tileTreeState = asClassifier ? this._classifierTileTreeState : this._tileTreeState;
    if (tileTreeState.edgesOmitted && edgesRequired)
      tileTreeState.clearTileTree();

    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    if (!asClassifier && this.jsonProperties.tilesetUrl !== undefined) {
      RealityModelTileTree.loadRealityModelTileTree(this.jsonProperties.tilesetUrl, this.jsonProperties.tilesetToDbTransform, tileTreeState);
      return tileTreeState.loadStatus;
    }
    return this.loadIModelTileTree(tileTreeState, batchType, edgesRequired, animationId, classifierExpansion);
  }

  private loadIModelTileTree(tileTreeState: TileTreeState, batchType: BatchType, edgesRequired: boolean, animationId?: Id64String, classifierExpansion?: number): TileTree.LoadStatus {
    let classificationPrefix;
    if (BatchType.VolumeClassifier === batchType || BatchType.PlanarClassifier === batchType)
      classificationPrefix = (BatchType.PlanarClassifier === batchType ? "CP" : "C") + ":" + classifierExpansion as string + "_";
    const id = (classificationPrefix ? classificationPrefix : "") + (animationId ? ("A:" + animationId + "_") : "") + this.id;
    const allowInstancing = undefined === classificationPrefix && undefined === animationId;

    this.iModel.tiles.getTileTreeProps(id).then((result: TileTreeProps) => {
      // NB: Make sure root content ID matches that expected by tile format major version...
      // back-end uses old format ("0/0/0/0/1") to support older front-ends.
      const loader = new IModelTile.Loader(this.iModel, result.formatVersion, batchType, edgesRequired, allowInstancing);
      result.rootTile.contentId = loader.rootContentId;
      tileTreeState.setTileTree(result, loader);

      this._tileTreeState.edgesOmitted = !edgesRequired;
      IModelApp.viewManager.onNewTilesReady();
    }).catch((_err) => {
      // Retry in case of timeout; otherwise fail.
      if (_err instanceof ServerTimeoutError)
        this._tileTreeState.loadStatus = TileTree.LoadStatus.NotLoaded;
      else
        this._tileTreeState.loadStatus = TileTree.LoadStatus.NotFound;

      IModelApp.viewManager.onNewTilesReady();
    });

    return tileTreeState.loadStatus;
  }

  /** @internal */
  public onIModelConnectionClose() {
    dispose(this._tileTreeState.tileTree);  // we do not track if we are disposed...catch this at the tiletree level
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
  /** Get the list of model classifiers */
  public getClassifiers(): Id64String[] {
    const result = new Array<Id64String>();
    const classifiers = this.jsonProperties.classifiers;
    if (classifiers !== undefined)
      for (const classifier of classifiers)
        if (undefined !== classifier.id)
          result.push(classifier.id);

    return result;
  }
  public async setActiveClassifier(classifierIndex: number, active: boolean) {
    const classifiers = this.jsonProperties.classifiers;
    if (classifiers !== undefined)
      for (let index = 0; index < classifiers.length; index++)
        if (false !== (classifiers[index].isActive = (classifierIndex === index && active)))
          await Classification.loadModelClassifiers(this.id, this.iModel);
  }
  public addClassifier(classifier: Classification.PropertiesProps) {
    if (undefined === this.jsonProperties.classifiers)
      this.jsonProperties.classifiers = [];

    this.jsonProperties.classifiers.push(classifier);
  }
}

/** Represents the front-end state of a [GeometricModel2d]($backend).
 * @public
 */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
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
  public get is3d(): boolean { return true; }
  /** @internal */
  public get asGeometricModel3d(): GeometricModel3dState { return this; }
}

/** Represents the front-end state of a [SheetModel]($backend).
 * @public
 */
export class SheetModelState extends GeometricModel2dState { }

/** Represents the front-end state of a [SpatialModel]($backend).
 * @public
 */
export class SpatialModelState extends GeometricModel3dState { }

/** Represents the front-end state of a [DrawingModel]($backend).
 * @public
 */
export class DrawingModelState extends GeometricModel2dState { }

/** Represents the front-end state of a [SectionDrawingModel]($backend).
 * @public
 */
export class SectionDrawingModelState extends DrawingModelState { }
