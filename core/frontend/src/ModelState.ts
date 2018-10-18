/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { Id64String, Id64, JsonUtils, dispose } from "@bentley/bentleyjs-core";
import { EntityState } from "./EntityState";
import { Point2d } from "@bentley/geometry-core";
import { ModelProps, GeometricModel2dProps, AxisAlignedBox3d, RelatedElement, TileTreeProps, BatchType } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTree, TileTreeState, IModelTileLoader } from "./tile/TileTree";
import { RealityModelTileTree } from "./tile/RealityModelTileTree";

/** Represents the front-end state of a [Model]($backend). */
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
  public getExtents(): AxisAlignedBox3d { return new AxisAlignedBox3d(); } // NEEDS_WORK

  /** Determine whether this is a GeometricModel */
  public get isGeometricModel(): boolean { return false; }

  /** Runs when the iModel of this iModelState closes. */
  public onIModelConnectionClose() { }

  /** Return whether this model's range should be used for "fit" tool */
  public useRangeForFit(): boolean { return true; }
}

/** Represents the front-end state of a [GeometricModel]($backend).
 * The contents of a GeometricModelState can be rendered inside a [[Viewport]].
 */
export abstract class GeometricModelState extends ModelState {
  /** @hidden */
  protected _tileTreeState: TileTreeState = new TileTreeState(this);
  /** @hidden */
  protected _classifierTileTreeState: TileTreeState = new TileTreeState(this);

  /** Returns true if this is a 3d model (a [[GeometricModel3dState]]). */
  public abstract get is3d(): boolean;
  /** Returns true if this is a 2d model (a [[GeometricModel2dState]]). */
  public get is2d(): boolean { return !this.is3d; }
  /** @hidden */
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  /** @hidden */
  public get classifierTileTree(): TileTree | undefined { return this._classifierTileTreeState.tileTree; }
  /** @hidden */
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  /** @hidden */
  public set loadStatus(status: TileTree.LoadStatus) { this._tileTreeState.loadStatus = status; }
  /** @hidden */
  public get isGeometricModel(): boolean { return true; }
  /** @hidden */
  public getOrLoadTileTree(): TileTree | undefined {
    if (undefined === this.tileTree)
      this.loadTileTree();

    return this.tileTree;
  }

  /** @hidden */
  public loadTileTree(asClassifier: boolean = false, classifierExpansion?: number): TileTree.LoadStatus {
    const tileTreeState = asClassifier ? this._classifierTileTreeState : this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    if (!asClassifier && this.jsonProperties.tilesetUrl !== undefined) {
      RealityModelTileTree.loadRealityModelTileTree(this.jsonProperties.tilesetUrl, this.jsonProperties.tilesetToDbTransform, tileTreeState);
      return tileTreeState.loadStatus;
    }

    return this.loadIModelTileTree(tileTreeState, asClassifier, classifierExpansion);
  }

  private loadIModelTileTree(tileTreeState: TileTreeState, asClassifier: boolean, classifierExpansion?: number): TileTree.LoadStatus {
    const id = asClassifier ? ("C:" + classifierExpansion as string + "_" + this.id) : this.id;

    this.iModel.tiles.getTileTreeProps(id).then((result: TileTreeProps) => {
      tileTreeState.setTileTree(result, new IModelTileLoader(this.iModel, asClassifier ? BatchType.Classifier : BatchType.Primary));
      IModelApp.viewManager.onNewTilesReady();
    }).catch((_err) => {
      this._tileTreeState.loadStatus = TileTree.LoadStatus.NotFound; // on separate line because stupid chrome debugger.
    });

    return tileTreeState.loadStatus;
  }

  /** @hidden */
  public onIModelConnectionClose() {
    dispose(this._tileTreeState.tileTree);  // we do not track if we are disposed...catch this at the tiletree level
    super.onIModelConnectionClose();
  }
}

/** Represents the front-end state of a [GeometricModel2d]($backend). */
export class GeometricModel2dState extends GeometricModelState implements GeometricModel2dProps {
  public readonly globalOrigin: Point2d;
  constructor(props: GeometricModel2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.globalOrigin = Point2d.fromJSON(props.globalOrigin);
  }

  /** Returns false. */
  public get is3d(): boolean { return false; }

  public toJSON(): GeometricModel2dProps {
    const val = super.toJSON() as GeometricModel2dProps;
    val.globalOrigin = this.globalOrigin;
    return val;
  }
}

/** Represents the front-end state of a [GeometricModel3d]($backend). */
export class GeometricModel3dState extends GeometricModelState {
  /** Returns true. */
  public get is3d(): boolean { return true; }
}

/** Represents the front-end state of a [SheetModel]($backend). */
export class SheetModelState extends GeometricModel2dState { }

/** Represents the front-end state of a [SpatialModel]($backend). */
export class SpatialModelState extends GeometricModel3dState { }

/** Represents the front-end state of a [DrawingModel]($backend). */
export class DrawingModelState extends GeometricModel2dState { }

/** Represents the front-end state of a [SectionDrawingModel]($backend). */
export class SectionDrawingModelState extends DrawingModelState { }
