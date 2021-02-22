/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */
import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import { Angle } from "@bentley/geometry-core";
import { CartographicRange, ContextRealityModelProps, FeatureAppearance, OrbitGtBlobProps } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { DisplayStyleState } from "./DisplayStyleState";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { PlanarClipMaskState } from "./imodeljs-frontend";
import { SpatialModelState } from "./ModelState";
import { SpatialClassifiers } from "./SpatialClassifiers";
import {
  createOrbitGtTileTreeReference, createRealityTileTreeReference, RealityModelTileClient, RealityModelTileTree, RealityModelTileUtils,
  TileTreeReference,
} from "./tile/internal";

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
 * @beta
 */
export class ContextRealityModelState {
  private readonly _treeRef: RealityModelTileTree.Reference;
  public readonly name: string;
  public readonly url: string;
  public readonly orbitGtBlob?: OrbitGtBlobProps;
  /** Not required to be present to display the model. It is use to elide the call to getRealityDataIdFromUrl in the widget if present. */
  public readonly realityDataId?: string;
  public readonly description: string;
  public readonly iModel: IModelConnection;
  private _appearanceOverrides?: FeatureAppearance;
  private _isGlobal?: boolean;

  public constructor(props: ContextRealityModelProps, iModel: IModelConnection, displayStyle: DisplayStyleState) {
    this.url = props.tilesetUrl;
    this.orbitGtBlob = props.orbitGtBlob;
    this.realityDataId = props.realityDataId;
    this.name = undefined !== props.name ? props.name : "";
    this.description = undefined !== props.description ? props.description : "";
    this.iModel = iModel;
    this._appearanceOverrides = props.appearanceOverrides ? FeatureAppearance.fromJSON(props.appearanceOverrides) : undefined;
    const classifiers = new SpatialClassifiers(props);
    this._treeRef = (undefined === props.orbitGtBlob) ?
      createRealityTileTreeReference({
        iModel,
        source: displayStyle,
        url: props.tilesetUrl,
        name: props.name,
        classifiers,
        planarMask: props.planarClipMask,
      }) :
      createOrbitGtTileTreeReference({
        iModel,
        orbitGtBlob: props.orbitGtBlob,
        name: props.name,
        classifiers,
        displayStyle,
      });
  }

  public get treeRef(): TileTreeReference { return this._treeRef; }
  public get classifiers(): SpatialClassifiers | undefined { return this._treeRef.classifiers; }
  public get appearanceOverrides(): FeatureAppearance | undefined { return this._appearanceOverrides; }
  public set appearanceOverrides(overrides: FeatureAppearance | undefined) { this._appearanceOverrides = overrides; }
  public get modelId(): Id64String | undefined { return (this._treeRef instanceof RealityModelTileTree.Reference) ? this._treeRef.modelId : undefined; }
  /** Return true if the model spans the entire globe ellipsoid in 3D */
  public get isGlobal(): boolean { return this.treeRef.isGlobal; }
  public get planarClipMask(): PlanarClipMaskState | undefined { return this._treeRef.planarClipMask; }
  public set planarClipMask(planarClipMask: PlanarClipMaskState | undefined) { this._treeRef.planarClipMask = planarClipMask; }

  public toJSON(): ContextRealityModelProps {
    return {
      tilesetUrl: this.url,
      orbitGtBlob: this.orbitGtBlob,
      realityDataId: this.realityDataId,
      name: 0 > this.name.length ? this.name : undefined,
      description: 0 > this.description.length ? this.description : undefined,
      appearanceOverrides: this.appearanceOverrides,
    };
  }

  /** ###TODO this is ridiculously slow (like, 10s of seconds) and downloads megabytes of data to extract range and throw it all away.
   * findAvailableRealityModels() already TAKES the project extents as a cartographic range to exclude so...
   */
  public async intersectsProjectExtents(): Promise<boolean> {
    if (undefined === this.iModel.ecefLocation)
      return false;

    const accessToken = await getAccessToken();
    if (!accessToken)
      return false;

    const client = new RealityModelTileClient(this.url, accessToken, this.iModel.contextId);
    const json = await client.getRootDocument(this.url);
    let tileTreeRange, tileTreeTransform;
    if (json === undefined ||
      undefined === json.root ||
      undefined === (tileTreeRange = RealityModelTileUtils.rangeFromBoundingVolume(json.root.boundingVolume)) ||
      undefined === (tileTreeTransform = RealityModelTileUtils.transformFromJson(json.root.transform)))
      return false;

    const treeCartographicRange = new CartographicRange(tileTreeRange.range, tileTreeTransform);
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
 * Returns a list of reality data associated to the given iTwin context
 * @param contextId id of associated iTwin context
 * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
 * @returns a list of reality model properties associated with the project
 * @alpha
 */
export async function findAvailableRealityModels(contextId: GuidString, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {
  return findAvailableUnattachedRealityModels(contextId, undefined, modelCartographicRange);
}

/**
 * Returns a list of reality data associated to the given iTwin context - but filters out any reality sets that are directly attached to the iModel.
 * @param contextId id of associated iTwin context
 * @param iModel the iModel -- reality data sets attached to this model will be excluded from the returned list.
 * @param modelCartographicRange optional cartographic range of the model that can limit the spatial range for the search
 * @returns a list of reality model properties associated with the project
 * @alpha
 */
export async function findAvailableUnattachedRealityModels(contextId: GuidString, iModel?: IModelConnection, modelCartographicRange?: CartographicRange | undefined): Promise<ContextRealityModelProps[]> {
  const availableRealityModels: ContextRealityModelProps[] = [];

  const accessToken: AccessToken | undefined = await getAccessToken();
  if (!accessToken)
    return availableRealityModels;

  const requestContext = await AuthorizedFrontendRequestContext.create();
  requestContext.enter();

  const client = new RealityDataClient();

  let realityData: RealityData[];
  if (modelCartographicRange) {
    const iModelRange = modelCartographicRange.getLongitudeLatitudeBoundingBox();
    realityData = await client.getRealityDataInProjectOverlapping(requestContext, contextId, Angle.radiansToDegrees(iModelRange.low.x),
      Angle.radiansToDegrees(iModelRange.high.x),
      Angle.radiansToDegrees(iModelRange.low.y),
      Angle.radiansToDegrees(iModelRange.high.y));
  } else {
    realityData = await client.getRealityDataInProject(requestContext, contextId);
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
      realityDataName = currentRealityData.name;
    } else if (currentRealityData.rootDocument) {
      // In case root document contains a relative path we only keep the filename
      const rootDocParts = (currentRealityData.rootDocument).split("/");
      realityDataName = rootDocParts[rootDocParts.length - 1];
    } else {
      // This case would not occur normally but if it does the RD is considered invalid
      validRd = false;
    }

    // If the RealityData is valid then we add it to the list.
    if (currentRealityData.id && validRd === true) {
      const url = await client.getRealityDataUrl(requestContext, contextId, currentRealityData.id);
      let opcConfig: OrbitGtBlobProps | undefined;

      if (currentRealityData.type && (currentRealityData.type.toUpperCase() === "OPC") && currentRealityData.rootDocument !== undefined) {
        const rootDocUrl: string = await currentRealityData.getBlobStringUrl(requestContext, currentRealityData.rootDocument);
        opcConfig = {
          containerName: "",
          blobFileName: rootDocUrl,
          accountName: "",
          sasToken: "",
        };
      }

      requestContext.enter();
      if (!modelRealityDataIds.has(currentRealityData.id))
        availableRealityModels.push({
          tilesetUrl: url, name: realityDataName, description: (currentRealityData.description ? currentRealityData.description : ""),
          realityDataId: currentRealityData.id, orbitGtBlob: opcConfig,
        });
    }
  }
  return availableRealityModels;
}
