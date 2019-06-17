/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { ContextRealityModelProps, CartographicRange } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { TileTreeModelState, SpatialModelState } from "./ModelState";
import { TileTree, TileTreeState, BatchedTileIdMap } from "./tile/TileTree";
import { RealityModelTileTree, RealityModelTileClient, RealityModelTileUtils } from "./tile/RealityModelTileTree";
import { RealityDataServicesClient, RealityData, AccessToken } from "@bentley/imodeljs-clients";
import { Id64String } from "@bentley/bentleyjs-core";
import { HitDetail } from "./HitDetail";

/** @internal */
export class ContextRealityModelState implements TileTreeModelState {
  protected _tilesetUrl: string;
  protected _name: string;
  protected _tileTreeState: TileTreeState;
  protected _iModel: IModelConnection;
  protected _modelId: Id64String;
  protected _jsonProperties: { [key: string]: any };
  protected _batchedIdMap = new BatchedTileIdMap();
  constructor(props: ContextRealityModelProps, iModel: IModelConnection) {
    this._name = props.name ? props.name : "";
    this._tilesetUrl = props.tilesetUrl;
    this._tileTreeState = iModel.getContextRealityModelTileTree(this._tilesetUrl);
    this._modelId = this._tileTreeState.modelId;
    this._iModel = iModel;
    this._jsonProperties = { classifiers: props.classifiers };
  }
  public get name() { return this._name; }
  public get url() { return this._tilesetUrl; }
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public get treeModelId(): Id64String { return this._modelId; }
  public get jsonProperties() { return this._jsonProperties; }
  public get iModel() { return this._iModel; }
  public get doDrapeBackgroundMap() { return this._tileTreeState.doDrapeBackgroundMap; }
  public loadTree(_edgesRequired: boolean, _animationId?: Id64String): TileTree.LoadStatus {
    const tileTreeState = this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    RealityModelTileTree.loadRealityModelTileTree(this._tilesetUrl, undefined, tileTreeState, this._batchedIdMap);

    return tileTreeState.loadStatus;
  }
  public getToolTip(hit: HitDetail): HTMLElement | string | undefined {

    const batchFound = this._batchedIdMap.getBatchProperties(hit.sourceId);
    if (batchFound === undefined && this._modelId !== hit.sourceId)
      return undefined;

    const strings = [];
    strings.push(this._name ? this._name : this._tilesetUrl);
    if (batchFound !== undefined)
      for (const key of Object.keys(batchFound))
        strings.push(key + ": " + batchFound[key]);

    let out = "";
    strings.forEach((line) => out += line + "<br>");
    return out;
  }

  private static async getAccessToken(): Promise<AccessToken | undefined> {
    if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.hasSignedIn)
      return undefined; // Not signed in
    let accessToken: AccessToken;
    try {
      accessToken = await IModelApp.authorizationClient.getAccessToken();
    } catch (error) {
      return undefined;
    }
    return accessToken;
  }

  /**
   * Indicates if the reality model overlaps the project extent
   * @returns a bool that indicates if the model and the reality data overlap
   */
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this._iModel.ecefLocation)
      return false;

    const accessToken = await ContextRealityModelState.getAccessToken();
    if (!accessToken)
      return false;

    const client = new RealityModelTileClient(this._tilesetUrl, accessToken);
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
   * @param other Another ContextRealityModelState object to compare with self.
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
  public static async findAvailableRealityModels(projectid: string, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> { return ContextRealityModelState.findAvailableUnattachedRealityModels(projectid, undefined, modelCartographicRange); }

  /**
   * Returns a list of reality data associated to the given CONNECT project - but filters out any reality sets that are directly attached to the iModel.
   * @param projectId id of associated connect project
   * @param iModel the iModel -- reality data sets attached to this model will be excluded from the returned list.
   * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
   * @returns a list of reality model properties associated with the project
   */
  public static async findAvailableUnattachedRealityModels(projectid: string, iModel?: IModelConnection, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {
    const availableRealityModels: ContextRealityModelProps[] = [];

    const accessToken: AccessToken | undefined = await ContextRealityModelState.getAccessToken();
    if (!accessToken)
      return availableRealityModels;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const client = new RealityDataServicesClient();

    let realityData: RealityData[];
    if (modelCartographicRange) {
      const iModelRange = modelCartographicRange.getLongitudeLatitudeBoundingBox();
      realityData = await client.getRealityDataInProjectOverlapping(requestContext, projectid, iModelRange);
    } else {
      realityData = await client.getRealityDataInProject(requestContext, projectid);
    }
    requestContext.enter();

    // Get set of URLs that are directly attached to the model.
    const modelRealityDataIds = new Set<string>();
    if (iModel) {
      const query = { from: SpatialModelState.classFullName, wantPrivate: false };
      const props = await iModel.models.queryProps(query);
      for (const prop of props)
        if (prop.jsonProperties !== undefined && prop.jsonProperties.tilesetUrl) {
          const realityDataId = client.getRealityDataIdFromUrl(prop.jsonProperties.tilesetUrl);
          if (realityDataId)
            modelRealityDataIds.add(realityDataId);
        }
    }

    // We obtain the reality data name, and RDS URL for each RD returned.
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
        const url = await client.getRealityDataUrl(requestContext, projectid, currentRealityData.id as string);
        requestContext.enter();
        if (!modelRealityDataIds.has(currentRealityData.id as string))
          availableRealityModels.push({ tilesetUrl: url, name: realityDataName, description: (currentRealityData.description ? currentRealityData.description : "") });
      }
    }
    return availableRealityModels;
  }
}
