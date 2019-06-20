/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ModelState */

import { compareBooleans, compareStrings, Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { BatchType, GeometricModel2dProps, ModelProps, RelatedElement } from "@bentley/imodeljs-common";
import { EntityState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { IModelTile } from "./tile/IModelTile";
import { createRealityTileTreeReference } from "./tile/RealityModelTileTree";
import { TileTree } from "./tile/TileTree";
import { HitDetail } from "./HitDetail";
import { ViewState } from "./ViewState";
import { SpatialClassifiers } from "./SpatialClassification";

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
  /** Attempts to cast this model to a spatial model. */
  public get asSpatialModel(): SpatialModelState | undefined { return undefined; }

  /** Executes just before the containing IModelConnection is closed to perform any necessary cleanup.
   * @internal
   */
  public onIModelConnectionClose() { }
  /**
   * Return the tool tip for this element.  This is called only if the hit  element (or decorators) do not return a tooltip.
   * @alpha
   */
  public getToolTip(_hit: HitDetail): HTMLElement | string | undefined { return undefined; }
}

/** Represents the front-end state of a [GeometricModel]($backend).
 * The contents of a GeometricModelState can be rendered inside a [[Viewport]].
 * @public
 */
export abstract class GeometricModelState extends ModelState {
  /** @internal */
  public static get className() { return "GeometricModel"; }

  private _modelRange?: Range3d;

  /** Returns true if this is a 3d model (a [[GeometricModel3dState]]). */
  public abstract get is3d(): boolean;
  /** @internal */
  public get asGeometricModel(): GeometricModelState { return this; }
  /** Returns true if this is a 2d model (a [[GeometricModel2dState]]). */
  public get is2d(): boolean { return !this.is3d; }

  /** @internal */
  public get isGeometricModel(): boolean { return true; }
  /** @internal */
  public get treeModelId(): Id64String { return this.id; }

  /** @internal */

  /** Query for the union of the ranges of all the elements in this GeometricModel. */
  public async queryModelRange(): Promise<Range3d> {
    if (undefined === this._modelRange) {
      const ranges = await this.iModel.models.queryModelRanges(this.id);
      this._modelRange = Range3d.fromJSON(ranges[0]);
    }
    return this._modelRange!;
  }

  /** @internal */
  public createTileTreeReference(view: ViewState): TileTree.Reference {
    // If this is a reality model, its tile tree is obtained from reality data service URL.
    const url = this.jsonProperties.tilesetUrl;
    if (undefined !== url) {
      const spatialModel = this.asSpatialModel;
      return createRealityTileTreeReference({
        url,
        iModel: this.iModel,
        modelId: this.id,
        tilesetToDbTransform: this.jsonProperties.tilesetToDbTransform,
        classifiers: undefined !== spatialModel ? spatialModel.classifiers : undefined,
      });
    }

    return new PrimaryTreeReference(view, this);
  }
}

interface PrimaryTreeId {
  treeId: IModelTile.PrimaryTreeId;
  modelId: Id64String;
  is3d: boolean;
}

class PrimaryTreeSupplier implements TileTree.Supplier {
  public compareTileTreeIds(lhs: PrimaryTreeId, rhs: PrimaryTreeId): number {
    let cmp = compareStrings(lhs.modelId, rhs.modelId);
    if (0 === cmp) {
      cmp = compareBooleans(lhs.is3d, rhs.is3d);
      if (0 === cmp) {
        cmp = IModelTile.compareTreeIds(lhs.treeId, rhs.treeId);
      }
    }

    return cmp;
  }

  public async createTileTree(id: PrimaryTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const treeId = id.treeId;
    const idStr = IModelTile.treeIdToString(id.modelId, treeId);
    const props = await iModel.tiles.getTileTreeProps(idStr);

    const allowInstancing = undefined === treeId.animationId;
    const edgesRequired = treeId.edgesRequired;

    const loader = new IModelTile.Loader(iModel, props.formatVersion, BatchType.Primary, edgesRequired, allowInstancing);
    props.rootTile.contentId = loader.rootContentId;
    const params = TileTree.paramsFromJSON(props, iModel, id.is3d, loader, id.modelId);
    return new TileTree(params);
  }

  public getOwner(id: PrimaryTreeId, iModel: IModelConnection): TileTree.Owner {
    return iModel.tiles.getTileTreeOwner(id, this);
  }
}

const primaryTreeSupplier = new PrimaryTreeSupplier();

class PrimaryTreeReference extends TileTree.Reference {
  private readonly _view: ViewState;
  private readonly _id: PrimaryTreeId;
  private _owner: TileTree.Owner;

  public constructor(view: ViewState, model: GeometricModelState) {
    super();
    this._view = view;
    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: PrimaryTreeReference.createTreeId(view, model.id),
    };
    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  public get treeOwner(): TileTree.Owner {
    const newId = PrimaryTreeReference.createTreeId(this._view, this._id.modelId);
    if (0 !== IModelTile.compareTreeIds(newId, this._id.treeId)) {
      this._id.treeId = newId;
      this._owner = primaryTreeSupplier.getOwner(this._id, this._view.iModel);
    }

    return this._owner;
  }

  private static createTreeId(view: ViewState, modelId: Id64String): IModelTile.PrimaryTreeId {
    const script = view.scheduleScript;
    const animationId = undefined !== script ? script.getModelAnimationId(modelId) : undefined;
    const edgesRequired = view.viewFlags.edgesRequired();
    return { type: BatchType.Primary, edgesRequired, animationId };
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
  /** If this is a reality model, provides access to a list of available spatial classifiers that can be applied to it.
   * @beta
   */
  public readonly classifiers?: SpatialClassifiers;

  /** @internal */
  public static get className() { return "SpatialModel"; }
  /** @internal */
  public get asSpatialModel(): SpatialModelState { return this; }

  public constructor(props: ModelProps, iModel: IModelConnection) {
    super(props, iModel);
    if (undefined !== this.jsonProperties.tilesetUrl)
      this.classifiers = new SpatialClassifiers(this.jsonProperties);
  }
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
