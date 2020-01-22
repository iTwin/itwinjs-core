/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { compareBooleans, compareStrings, Id64String } from "@bentley/bentleyjs-core";
import {
  BatchType,
  compareIModelTileTreeIds,
  iModelTileTreeIdToString,
  PrimaryTileTreeId,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { TileTree, TileTreeReference, TileTreeOwner, TileTreeSupplier, tileTreeParamsFromJSON, IModelTileLoader } from "./internal";
import { ViewState } from "../ViewState";
import { IModelApp } from "../IModelApp";
import { GeometricModelState } from "../ModelState";

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

    const allowInstancing = undefined === treeId.animationId;
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
  private readonly _view: ViewState;
  private readonly _model: GeometricModelState;
  private _id: PrimaryTreeId;
  private _owner: TileTreeOwner;

  public constructor(view: ViewState, model: GeometricModelState) {
    super();
    this._view = view;
    this._model = model;
    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: PrimaryTreeReference.createTreeId(view, model.id),
      guid: model.geometryGuid,
    };
    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  public get treeOwner(): TileTreeOwner {
    const newId = PrimaryTreeReference.createTreeId(this._view, this._id.modelId);
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

  private static createTreeId(view: ViewState, modelId: Id64String): PrimaryTileTreeId {
    const script = view.scheduleScript;
    const animationId = undefined !== script ? script.getModelAnimationId(modelId) : undefined;
    const edgesRequired = view.viewFlags.edgesRequired();
    return { type: BatchType.Primary, edgesRequired, animationId };
  }
}

/** @internal */
export function createPrimaryTileTreeReference(view: ViewState, model: GeometricModelState): TileTreeReference {
  return new PrimaryTreeReference(view, model);
}
