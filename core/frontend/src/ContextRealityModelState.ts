/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { ContextRealityModelProps, CartographicRange } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { SpatialModelState } from "./ModelState";
import { TileTree } from "./tile/TileTree";
import { createRealityTileTreeReference, RealityModelTileClient, RealityModelTileUtils } from "./tile/RealityModelTileTree";
import { RealityDataServicesClient, RealityData, AccessToken } from "@bentley/imodeljs-clients";
import { SpatialClassifiers } from "./SpatialClassification";

async function getAccessToken(): Promise<AccessToken | undefined> {
  if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.hasSignedIn)
    return undefined; // Not signed in

  try {
    return IModelApp.authorizationClient.getAccessToken();
  } catch (_) {
    return undefined;
  }
}

/** A reference to a [[TileTree]] obtained from a reality data service and associated to a [[ViewState]] by way of its [[DisplayStyleState]].
 * Contrast with a persistent [[GeometricModelState]] which may contain a URL pointing to a [[TileTree]] hosted on a reality data service.
 * @internal
 */
export class ContextRealityModelState {
  public readonly treeRef: TileTree.Reference;
  public readonly name: string;
  public readonly url: string;
  public readonly description: string;
  public readonly iModel: IModelConnection;

  public constructor(props: ContextRealityModelProps, iModel: IModelConnection) {
    this.url = props.tilesetUrl;
    this.name = undefined !== props.name ? props.name : "";
    this.description = undefined !== props.description ? props.description : "";
    this.iModel = iModel;

    this.treeRef = createRealityTileTreeReference({
      iModel,
      url: props.tilesetUrl,
      name: props.name,
      classifiers: new SpatialClassifiers(props),
    });
  }

  public toJSON(): ContextRealityModelProps {
    return {
      tilesetUrl: this.url,
      name: 0 > this.name.length ? this.name : undefined,
      description: 0 > this.description.length ? this.description : undefined,
    };
  }

  /** ###TODO this is ridiculously slow (like, 10s of seconds) and downlaods megabytes of data to extract range and throw it all away.
   * findAvailableRealityModels() already TAKES the project extents as a cartographic range to exclude so...
   */
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this.iModel.ecefLocation)
      return false;

    const accessToken = await getAccessToken();
    if (!accessToken)
      return false;

    const client = new RealityModelTileClient(this.url, accessToken);
    const json = await client.getRootDocument(this.url);
    let tileTreeRange, tileTreeTransform;
    if (json === undefined ||
      undefined === json.root ||
      undefined === (tileTreeRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume)) ||
      undefined === (tileTreeTransform = RealityModelTileUtils.transformFromJson(json.root.transform)))
      return false;

    const treeCartographicRange = new CartographicRange(tileTreeRange, tileTreeTransform);
    const projectCartographicRange = new CartographicRange(this.iModel.projectExtents, this.iModel.ecefLocation.getTransform());

    return treeCartographicRange.intersectsRange(projectCartographicRange);
  }

  public matches(other: ContextRealityModelState): boolean {
    return this.matchesNameAndUrl(other.name, other.url);
  }

  public matchesNameAndUrl(name: string, url: string): boolean {
    return this.name === name && this.url === url;
  }
}

/**
 * Returns a list of reality data associated to the given CONNECT project
 * @param projectId id of associated connect project
 * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
 * @returns a list of reality model properties associated with the project
 * @alpha
 */
export async function findAvailableRealityModels(projectid: string, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {
  return findAvailableUnattachedRealityModels(projectid, undefined, modelCartographicRange);
}

/**
 * Returns a list of reality data associated to the given CONNECT project - but filters out any reality sets that are directly attached to the iModel.
 * @param projectId id of associated connect project
 * @param iModel the iModel -- reality data sets attached to this model will be excluded from the returned list.
 * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
 * @returns a list of reality model properties associated with the project
 * @alpha
 */
export async function findAvailableUnattachedRealityModels(projectid: string, iModel?: IModelConnection, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {
  const availableRealityModels: ContextRealityModelProps[] = [];

  const accessToken: AccessToken | undefined = await getAccessToken();
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
