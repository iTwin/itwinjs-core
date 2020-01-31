/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  compareBooleans,
  compareStrings,
  Id64String,
} from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import {
  BatchType,
  compareIModelTileTreeIds,
  iModelTileTreeIdToString,
  PrimaryTileTreeId,
  ViewFlag,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import {
  IModelTileLoader,
  TileDrawArgs,
  TileGraphicType,
  TileTree,
  TileTreeOwner,
  TileTreeReference,
  TileTreeSupplier,
  tileTreeParamsFromJSON,
} from "./internal";
import {
  ViewState,
  ViewState3d,
} from "../ViewState";
import { IModelApp } from "../IModelApp";
import { GeometricModelState } from "../ModelState";
import { SceneContext } from "../ViewContext";

interface PrimaryTreeId {
  readonly treeId: PrimaryTileTreeId;
  readonly modelId: Id64String;
  readonly is3d: boolean;
  readonly guid: string | undefined;
}

class PrimaryTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: PrimaryTreeId, rhs: PrimaryTreeId): number {
    // NB: We intentionally do not compare the guids. They are expected to be equal if the modelIds are equal.
    let cmp = compareStrings(lhs.modelId, rhs.modelId);
    if (0 === cmp) {
      cmp = compareBooleans(lhs.is3d, rhs.is3d);
      if (0 === cmp) {
        cmp = compareIModelTileTreeIds(lhs.treeId, rhs.treeId);
      }
    }

    return cmp;
  }

  public async createTileTree(id: PrimaryTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const treeId = id.treeId;
    const idStr = iModelTileTreeIdToString(id.modelId, treeId, IModelApp.tileAdmin);
    const props = await iModel.tiles.getTileTreeProps(idStr);

    const allowInstancing = undefined === treeId.animationId && !treeId.enforceDisplayPriority;
    const edgesRequired = treeId.edgesRequired;

    const loader = new IModelTileLoader(iModel, props.formatVersion, BatchType.Primary, edgesRequired, allowInstancing, id.guid);
    props.rootTile.contentId = loader.rootContentId;
    const params = tileTreeParamsFromJSON(props, iModel, id.is3d, loader, id.modelId);
    return new TileTree(params);
  }

  public getOwner(id: PrimaryTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(id, this);
  }
}

const primaryTreeSupplier = new PrimaryTreeSupplier();

class PrimaryTreeReference extends TileTreeReference {
  protected readonly _view: ViewState;
  protected readonly _model: GeometricModelState;
  protected _id: PrimaryTreeId;
  private _owner: TileTreeOwner;

  public constructor(view: ViewState, model: GeometricModelState) {
    super();
    this._view = view;
    this._model = model;
    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: this.createTreeId(view, model.id),
      guid: model.geometryGuid,
    };
    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  public get treeOwner(): TileTreeOwner {
    const newId = this.createTreeId(this._view, this._id.modelId);
    if (0 !== compareIModelTileTreeIds(newId, this._id.treeId)) {
      this._id = {
        modelId: this._id.modelId,
        is3d: this._id.is3d,
        treeId: newId,
        guid: this._id.guid,
      };

      this._owner = primaryTreeSupplier.getOwner(this._id, this._model.iModel);
    }

    return this._owner;
  }

  protected createTreeId(view: ViewState, modelId: Id64String): PrimaryTileTreeId {
    const script = view.scheduleScript;
    const animationId = undefined !== script ? script.getModelAnimationId(modelId) : undefined;
    const edgesRequired = view.viewFlags.edgesRequired();
    return { type: BatchType.Primary, edgesRequired, animationId };
  }
}

class PlanProjectionTreeReference extends PrimaryTreeReference {
  private get _view3d() { return this._view as ViewState3d; }
  private _curTransform?: { transform: Transform, elevation?: number };
  private readonly _viewFlagOverrides = new ViewFlag.Overrides();

  public constructor(view: ViewState3d, model: GeometricModelState) {
    super(view, model);
    this._viewFlagOverrides.setForceSurfaceDiscard(true);
  }

  protected getViewFlagOverrides(_tree: TileTree) {
    return this._viewFlagOverrides;
  }

  public createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined !== args && this._id.treeId.enforceDisplayPriority) {
      args.drawGraphics = () => {
        const graphics = args.produceGraphics();
        if (undefined !== graphics) {
          const settings = this.getSettings();
          const asOverlay = undefined !== settings && settings.overlay;
          const transparency = settings?.transparency || 0;
          context.outputGraphic(context.target.renderSystem.createGraphicLayerContainer(graphics, asOverlay, transparency));
        }
      };
    }

    return args;
  }

  protected computeTransform(tree: TileTree): Transform {
    const settings = this.getSettings();
    const elevation = undefined !== settings ? settings.elevation : undefined;
    if (undefined === this._curTransform) {
      this._curTransform = { transform: tree.iModelTransform.clone() };
    } else if (this._curTransform.elevation !== elevation) {
      const transform = tree.iModelTransform.clone();
      if (undefined !== elevation)
        transform.origin.z = elevation;

      this._curTransform.transform = transform;
      this._curTransform.elevation = elevation;
    }

    return this._curTransform.transform;
  }

  public draw(args: TileDrawArgs): void {
    const settings = this.getSettings();
    if (undefined === settings || settings.enforceDisplayPriority || !settings.overlay)
      super.draw(args);
    else
      args.context.withGraphicTypeAndPlane(TileGraphicType.Overlay, undefined, () => args.root.draw(args));
  }

  private getSettings() {
    return this._view3d.getDisplayStyle3d().settings.getPlanProjectionSettings(this._model.id);
  }

  protected createTreeId(view: ViewState, modelId: Id64String): PrimaryTileTreeId {
    const id = super.createTreeId(view, modelId);
    const settings = this.getSettings();
    if (undefined !== settings && settings.enforceDisplayPriority)
      id.enforceDisplayPriority = true;

    return id;
  }
}

/** @internal */
export function createPrimaryTileTreeReference(view: ViewState, model: GeometricModelState): TileTreeReference {
  if (IModelApp.renderSystem.options.planProjections) {
    const model3d = view.is3d() ? model.asGeometricModel3d : undefined;
    if (undefined !== model3d && model3d.isPlanProjection)
      return new PlanProjectionTreeReference(view as ViewState3d, model);
  }

  return new PrimaryTreeReference(view, model);
}
