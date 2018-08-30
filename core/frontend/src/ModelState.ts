/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { Id64, JsonUtils, dispose } from "@bentley/bentleyjs-core";
import { EntityState } from "./EntityState";
import { Point2d } from "@bentley/geometry-core";
import { ModelProps, GeometricModel2dProps, AxisAlignedBox3d, RelatedElement, TileTreeProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTree, TileTreeState, IModelTileLoader } from "./tile/TileTree";
import { RealityModelTileTree } from "./tile/RealityModelTileTree";

/** The state of a Model */
export class ModelState extends EntityState implements ModelProps {
  public readonly modeledElement: RelatedElement;
  public readonly name: string;
  public parentModel: Id64;
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
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK

  /** Determine whether this is a GeometricModel */
  public get isGeometricModel(): boolean { return false; }

  /** Runs when the iModel of this iModelState closes. */
  public onIModelConnectionClose() { }

  /** Return whether this model's range should be used for "fit" tool */
  public useRangeForFit(): boolean { return true; }
}

/** The state of a geometric model */
export abstract class GeometricModelState extends ModelState {
  protected _tileTreeState: TileTreeState = new TileTreeState(this);
  protected _classifierTileTreeState: TileTreeState = new TileTreeState(this);

  public abstract get is3d(): boolean;
  public get is2d(): boolean { return !this.is3d; }
  /** @hidden */
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  /** @hidden */
  public get classifierTileTree(): TileTree | undefined { return this._classifierTileTreeState.tileTree; }
  /** @hidden */
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public set loadStatus(status: TileTree.LoadStatus) { this._tileTreeState.loadStatus = status; }
  /** Override of ModelState method, returns true */
  public get isGeometricModel(): boolean { return true; }
  /** @hidden */
  public getOrLoadTileTree(): TileTree | undefined {
    if (undefined === this.tileTree)
      this.loadTileTree();

    return this.tileTree;
  }

  /** @hidden */
  public loadTileTree(asClassifier: boolean = false): TileTree.LoadStatus {
    const tileTreeState = asClassifier ? this._classifierTileTreeState : this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    if (!asClassifier && this.jsonProperties.tilesetUrl !== undefined) {
      RealityModelTileTree.loadRealityModelTileTree(this.jsonProperties.tilesetUrl, tileTreeState);
      return tileTreeState.loadStatus;
    }
    return this.loadIModelTileTree(tileTreeState, asClassifier);
  }

  private loadIModelTileTree(tileTreeState: TileTreeState, asClassifier: boolean): TileTree.LoadStatus {
    const ids = new Set<string>();
    ids.add(asClassifier ? ("Classifier_" + this.id.value) : this.id.value);

    this.iModel.tiles.getTileTreeProps(ids).then((result: TileTreeProps[]) => {
      tileTreeState.setTileTree(result[0], new IModelTileLoader(this.iModel, result[0].id, asClassifier));
      IModelApp.viewManager.onNewTilesReady();
    }).catch((_err) => this._tileTreeState.loadStatus = TileTree.LoadStatus.NotFound);

    return tileTreeState.loadStatus;
  }
  public onIModelConnectionClose() {
    dispose(this._tileTreeState.tileTree);  // we do not track if we are disposed...catch this at the tiletree level
    super.onIModelConnectionClose();
  }
}

/** The state of a 2d Geometric Model */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  public get is3d(): boolean { return false; }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** The state of a 3d Geometric Model */
export class GeometricModel3dState extends GeometricModelState {
  /** Returns true. */
  public get is3d(): boolean { return true; }
}

/**
 * The state of a SheetModel.
 *
 * A SheetModel is a GeometricModel2d that has the following characteristics:
 * * Has finite extents, specified in meters (the *page size*.)
 * * Can contain views of other models, like pictures pasted on a photo album.
 */
export class SheetModelState extends GeometricModel2dState { }

/** The state of a SpatialModel */
export class SpatialModelState extends GeometricModel3dState { }

/** The state of a DrawingModel */
export class DrawingModelState extends GeometricModel2dState { }

/** The state of a SectionDrawingModel */
export class SectionDrawingModelState extends DrawingModelState { }
