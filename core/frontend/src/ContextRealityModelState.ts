/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { ContextRealityModelProps, CartographicRange } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { TileTreeModelState } from "./ModelState";
import { TileTree, TileTreeState } from "./tile/TileTree";
import { RealityModelTileTree, RealityModelTileClient, RealityModelTileUtils } from "./tile/RealityModelTileTree";
import { RealityDataServicesClient } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

export class ContextRealityModelState implements TileTreeModelState {
  protected _tilesetUrl: string;
  protected _name: string;
  protected _tileTreeState: TileTreeState;
  protected _iModel: IModelConnection;
  constructor(props: ContextRealityModelProps, iModel: IModelConnection) {
    this._name = props.name ? props.name : "";
    this._tilesetUrl = props.tilesetUrl;
    this._tileTreeState = new TileTreeState(iModel, true, "");
    this._iModel = iModel;
  }
  public get name() { return this._name; }
  public get url() { return this._tilesetUrl; }
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public loadTileTree(_asClassifier?: boolean, _classifierExpansion?: number): TileTree.LoadStatus {
    const tileTreeState = this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    RealityModelTileTree.loadRealityModelTileTree(this._tilesetUrl, undefined, tileTreeState);
    return tileTreeState.loadStatus;
  }
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this._iModel.ecefLocation || undefined === IModelApp.accessToken)
      return false;

    const client = new RealityModelTileClient(this._tilesetUrl, IModelApp.accessToken);
    const json = await client.getRootDocument(this._tilesetUrl);
    let tileTreeRange, tileTreeTransform;
    if (json === undefined ||
      undefined === json.root ||
      undefined === (tileTreeRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume, this._iModel.ecefLocation)) ||
      undefined === (tileTreeTransform = RealityModelTileUtils.transformFromJson(json.root.transform)))
      return false;

    const treeCartographicRange = new CartographicRange(tileTreeRange, tileTreeTransform);
    const projectCartographicRange = new CartographicRange(this._iModel.projectExtents, this._iModel.ecefLocation.getTransform());

    return treeCartographicRange.intersectsRange(projectCartographicRange);
  }
  public matches(other: ContextRealityModelState) {
    return other.name === this.name && other.url === this.url;
  }
  public static async findAvailableRealityModels(): Promise<ContextRealityModelProps[]> {

    const availableRealityModels: ContextRealityModelProps[] = [];

    if (undefined !== IModelApp.accessToken) {
      // ##TODO Alain Robert - This needs an instance of the RealityDataServicesClient which inherits from WSGClient that is by principle stateful
      // ## though we only use a method that could be static except for the WSG states (the WSG version mainly). This seems to indicate
      // ## instances of this class should be stateless (except for the WSG states which we can do nothing about). This is not currently the case.
      const client = new RealityDataServicesClient();
      const alctx = new ActivityLoggingContext(Guid.createValue());
      // ##TODO Alain Robert - The projectid of the database must be obtained and used here.
      const projectId: string = "Server";
      const realityData = await client.getRealityDataInProject(alctx, IModelApp.accessToken, projectId);

      let currentNonameNum: number = 0;
      for (const currentRealityData of realityData) {
        let realityDataName: string;
        if (currentRealityData.name && currentRealityData.name !== "") {
          realityDataName = currentRealityData.name as string;
        } else {
          realityDataName = `noname-${currentNonameNum}`;
          currentNonameNum++;
        }

        if (currentRealityData.id) {
          const url = await client.getRealityDataUrl(alctx, projectId, currentRealityData.id as string);
          availableRealityModels.push({ tilesetUrl: url, name: realityDataName });
        }
      }
    }

    return availableRealityModels;
  }
}
