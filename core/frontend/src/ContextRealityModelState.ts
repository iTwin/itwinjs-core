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
import { RealityDataServicesClient, RealityData } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid, Id64String } from "@bentley/bentleyjs-core";

export class ContextRealityModelState implements TileTreeModelState {
  protected _tilesetUrl: string;
  protected _name: string;
  protected _tileTreeState: TileTreeState;
  protected _iModel: IModelConnection;
  protected _modelId: Id64String;
  constructor(props: ContextRealityModelProps, iModel: IModelConnection) {
    this._name = props.name ? props.name : "";
    this._tilesetUrl = props.tilesetUrl;
    this._modelId = iModel.transientIds.next;
    this._tileTreeState = new TileTreeState(iModel, true, this._modelId);
    this._iModel = iModel;
  }
  public get name() { return this._name; }
  public get url() { return this._tilesetUrl; }
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public get treeModelId(): Id64String { return this._modelId; }
  public loadTileTree(_edgesRequired: boolean, _animationId?: Id64String, _asClassifier?: boolean, _classifierExpansion?: number): TileTree.LoadStatus {
    const tileTreeState = this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    RealityModelTileTree.loadRealityModelTileTree(this._tilesetUrl, undefined, tileTreeState);
    return tileTreeState.loadStatus;
  }
  /**
   * Indicates if the reality model overlaps the project extent
   * @returns a bool that indicates if the model and the reality data overlap
   */
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this._iModel.ecefLocation || undefined === IModelApp.accessToken)
      return false;

    const client = new RealityModelTileClient(this._tilesetUrl, IModelApp.accessToken);
    const json = await client.getRootDocument(this._tilesetUrl);
    let tileTreeRange, tileTreeTransform;
    if (json === undefined ||
      undefined === json.root ||
      undefined === (tileTreeRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume)) ||
      undefined === (tileTreeTransform = RealityModelTileUtils.transformFromJson(json.root.transform)))
      return false;

    const treeCartographicRange = new CartographicRange(tileTreeRange, tileTreeTransform);
    const projectCartographicRange = new CartographicRange(this._iModel.projectExtents, this._iModel.ecefLocation.getTransform());

    return treeCartographicRange.intersectsRange(projectCartographicRange);
  }
  /**
   * Gets a tileset's tile data blob key url
   * @param other Another ContextRealityModelState oject to compare with self.
   * @returns a bool that indicates if the two match
   */
  public matches(other: ContextRealityModelState) {
    return other.name === this.name && other.url === this.url;
  }
  /**
   * Returns a list of reality data associated to the given CONNECT project
   * @param projectId id of associated connect project
   * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
   * @returns a list of reality model properties associated with the project
   */
  public static async findAvailableRealityModels(projectid: string, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {

    const availableRealityModels: ContextRealityModelProps[] = [];

    if (undefined !== IModelApp.accessToken) {
      // ##TODO Alain Robert - This needs an instance of the RealityDataServicesClient which inherits from WSGClient that is by principle stateful
      // ## though we only use a method that could be static except for the WSG states (the WSG version mainly). This seems to indicate
      // ## instances of this class should be stateless (except for the WSG states which we can do nothing about). This is not currently the case.
      const client = new RealityDataServicesClient();
      const alctx = new ActivityLoggingContext(Guid.createValue());

      let realityData: RealityData[];
      if (modelCartographicRange) {
        const polygon = modelCartographicRange.getLongitudeLatitudeBoundingBox();

        realityData = await client.getRealityDataInProjectOverlapping(alctx, IModelApp.accessToken, projectid, polygon);

      } else {
        realityData = await client.getRealityDataInProject(alctx, IModelApp.accessToken, projectid);
      }

      // We obtain the reality data name, and RDS URL for each RD retuned.
      for (const currentRealityData of realityData) {
        let realityDataName: string = "";
        let validRd: boolean = true;
        if (currentRealityData.name && currentRealityData.name !== "") {
          realityDataName = currentRealityData.name as string;
        } else if (currentRealityData.rootDocument) {
          // In case root document contains a relative path we only keep the filename
          const rootDocParts = (currentRealityData.rootDocumentb as string).split("/");
          realityDataName = rootDocParts[rootDocParts.length - 1];
        } else {
          // This case would not occur normally but if it does the RD is considered invalid
          validRd = false;
        }

        // If the RealityData is valid then we add it to the list.
        if (currentRealityData.id && validRd === true) {
          const url = await client.getRealityDataUrl(alctx, projectid, currentRealityData.id as string);
          availableRealityModels.push({ tilesetUrl: url, name: realityDataName, description: (currentRealityData.description ? currentRealityData.description : "") });
        }
      }
    }

    return availableRealityModels;
  }
}
