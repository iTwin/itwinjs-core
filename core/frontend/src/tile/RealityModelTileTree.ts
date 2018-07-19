/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { IModelError, TileTreeProps, TileProps, TileId } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Id64Props, Id64, BentleyStatus, assert, StopWatch, Guid } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core";
import { RealityDataServicesClient, AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, getArrayBuffer, getJson } from "@bentley/imodeljs-clients";
import { SpatialModelState } from "../ModelState";
import { TileTree, TileLoader } from "./TileTree";
import { IModelApp } from "../IModelApp";

function debugPrint(str: string): void {
  console.log(str); // tslint:disable-line:no-console
}

class CesiumUtils {
  public static rangeFromBoundingVolume(boundingVolume: any): Range3d {
    const box: number[] = boundingVolume.box;
    const center = Point3d.create(box[0], box[1], box[2]);
    const ux = Vector3d.create(box[3], box[4], box[5]);
    const uy = Vector3d.create(box[6], box[7], box[8]);
    const uz = Vector3d.create(box[9], box[10], box[11]);
    const corners: Point3d[] = [];
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        for (let l = 0; l < 2; l++) {
          corners.push(center.plus3Scaled(ux, (j ? -1.0 : 1.0), uy, (k ? -1.0 : 1.0), uz, (l ? -1.0 : 1.0)));
        }
      }
    }
    return Range3d.createArray(corners);
  }
  public static maximumSizeFromGeometricTolerance(range: Range3d, geometricError: number): number {
    const minToleranceRatio = .5;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  public static transformFromJson(jTrans: number[] | undefined): Transform {
    return (jTrans === undefined) ? Transform.createIdentity() : Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), RotMatrix.createRowValues(jTrans[0], jTrans[4], jTrans[8], jTrans[1], jTrans[5], jTrans[9], jTrans[2], jTrans[6], jTrans[10]));
  }
}

class RealityModelTileTreeProps implements TileTreeProps {
  public id: Id64Props = "";
  public rootTile: TileProps;
  public location: TransformProps;
  public tilesetJson: object;
  public yAxisUp: boolean = false;
  constructor(json: any, public client: RealityModelTileClient, tileToDb: Transform, rootGeometry: ArrayBuffer | undefined) {
    this.tilesetJson = json.root;
    this.id = new Id64();
    this.rootTile = new RealityModelTileProps(json.root, "", this, rootGeometry);
    this.location = tileToDb.toJSON();
    if (json.asset.gltfUpAxis === undefined || json.asset.gltfUpAxis === "y")
      this.yAxisUp = true;
  }
}

class RealityModelTileProps implements TileProps {
  public id: TileId;
  public range: Range3dProps;
  public contentRange?: Range3dProps;
  public maximumSize: number;
  public childIds: string[];
  public geometry?: string | ArrayBuffer;
  public yAxisUp: boolean;
  constructor(json: any, thisId: string, public tree: RealityModelTileTreeProps, geometry: ArrayBuffer | undefined) {
    this.id = new TileId(new Id64(), thisId);
    this.range = CesiumUtils.rangeFromBoundingVolume(json.boundingVolume);
    this.maximumSize = 0.0; // nonzero only if content present.   CesiumUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError);
    this.yAxisUp = tree.yAxisUp;
    this.childIds = [];
    const prefix = thisId.length ? thisId + "_" : "";
    if (Array.isArray(json.children))
      for (let i = 0; i < json.children.length; i++)
        this.childIds.push(prefix + i);

    if (geometry !== undefined) {
      this.contentRange = json.content.boundingVolume && CesiumUtils.rangeFromBoundingVolume(json.content.boundingVolume);
      this.maximumSize = CesiumUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError);
      this.geometry = geometry;
    }
  }
}

class RealityModelTileLoader extends TileLoader {
  constructor(private tree: RealityModelTileTreeProps) { super(); }
  public getMaxDepth(): number { return 32; }  // Can be removed when element tile selector is working.

  public async getTileProps(tileIds: string[]): Promise<TileProps[]> {
    const props: RealityModelTileProps[] = [];
    const stopWatch = new StopWatch("", true);
    debugPrint("requesting " + tileIds.length + " tiles");
    await Promise.all(tileIds.map(async (tileId) => {
      const tile = await this.findTileInJson(this.tree.tilesetJson, tileId, "");
      if (tile !== undefined)
        props.push(tile);
    }));

    let totalBytes = 0;
    for (const prop of props) {
      if (undefined !== prop.geometry)
        totalBytes += (prop.geometry as ArrayBuffer).byteLength;
    }
    debugPrint("returning " + props.length + " tiles, Size: " + totalBytes + " Elapsed time: " + stopWatch.elapsedSeconds);

    return props;
  }
  private async findTileInJson(tilesetJson: any, id: string, parentId: string): Promise<RealityModelTileProps | undefined> {
    const separatorIndex = id.indexOf("_");
    const childId = (separatorIndex < 0) ? id : id.substring(0, separatorIndex);
    const childIndex = parseInt(childId, 10);

    if (isNaN(childIndex) || tilesetJson === undefined || tilesetJson.children === undefined || childIndex >= tilesetJson.children.length) {
      assert(false, "scalable mesh child not found.");
      return undefined;
    }

    let foundChild = tilesetJson.children[childIndex];
    const thisParentId = parentId.length ? (parentId + "_" + childId) : childId;
    if (separatorIndex >= 0) { return this.findTileInJson(foundChild, id.substring(separatorIndex + 1), thisParentId); }
    if (undefined === foundChild.content)
      return new RealityModelTileProps(foundChild, thisParentId, this.tree, undefined);

    if (foundChild.content.url.endsWith("json")) {
      const subTree = await this.tree.client.getTileJson(foundChild.content.url);
      foundChild = subTree.root;
      tilesetJson.children[childIndex] = subTree.root;
    }

    const content = await this.tree.client.getTileContent(foundChild.content.url);
    assert(content !== undefined, "scalable mesh tile content not found.");
    return new RealityModelTileProps(foundChild, thisParentId, this.tree, content);
  }
}

/** @hidden */
export class RealityModelTileTree {
  public static loadRealityModelTileTree(url: string, modelState: SpatialModelState): void {

    this.getTileTreeProps(url, modelState.iModel).then((tileTreeProps: RealityModelTileTreeProps) => {
      modelState.setTileTree(tileTreeProps, new RealityModelTileLoader(tileTreeProps));
      IModelApp.viewManager.onNewTilesReady();
    }).catch((_err) => modelState.loadStatus = TileTree.LoadStatus.NotFound);
  }

  private static async getTileTreeProps(url: string, iModel: IModelConnection): Promise<RealityModelTileTreeProps> {
    if (undefined !== url) {
      await RealityModelTileClient.setToken(); // ###TODO we should not set the token here in the future!
      const tileClient = new RealityModelTileClient(url);
      const json = await tileClient.getRootDocument(url);
      const ecefLocation = iModel.ecefLocation;
      const rootTransform: Transform = CesiumUtils.transformFromJson(json.root.transform);
      let tileToDb = Transform.createIdentity();

      if (ecefLocation !== undefined) {
        const dbToEcef = Transform.createOriginAndMatrix(ecefLocation.origin, ecefLocation.orientation.toRotMatrix());
        const ecefToDb = dbToEcef.inverse() as Transform;
        tileToDb.setMultiplyTransformTransform(ecefToDb, rootTransform);
      } else {
        tileToDb = rootTransform;
      }
      let rootGeometry: ArrayBuffer | undefined;
      if (undefined !== json.root.content && undefined !== json.root.content.url)
        rootGeometry = await tileClient.getTileContent(json.root.content.url);

      return new RealityModelTileTreeProps(json, tileClient, tileToDb, rootGeometry);
    } else {
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");
    }
  }
}

interface RDSClientProps {
  projectId: string;
  tilesId: string;
}

// ##TODO temporarly here for testing, needs to be moved to the clients repo
class RealityModelTileClient {
  public rdsProps?: RDSClientProps;
  private baseUrl: string = "";
  private static token?: AccessToken;
  private static client = new RealityDataServicesClient("QA"); // ###TODO the deployementEnv needs to be customizeable

  // ###TODO we should be able to pass the projectId / tileId directly, instead of parsing the url
  constructor(url: string) {
    this.rdsProps = this.parseUrl(url);
  }

  // ###TODO temporary means of extracting the tileId and projectId from the given url
  private parseUrl(url: string): RDSClientProps | undefined {
    const urlParts = url.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
    const tilesId = urlParts.find(Guid.isGuid);
    let props: RDSClientProps | undefined;
    if (undefined !== tilesId) {
      let projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];

      // ###TODO This is a temporary workaround for accessing the reality meshes with a test account
      // The hardcoded project id corresponds to a project setup to yied access to the test account which is linked to the tileId
      if (projectId === "Server")
        projectId = "fb1696c8-c074-4c76-a539-a5546e048cc6";

      props = { projectId, tilesId };
    }
    return props;
  }

  // ###TODO this needs to be integrated with the IModelConnection lifecycle,
  // when the IModelConnection closes, a listener to that event should set the token as undefined
  // when a token is used to open an imodel, that token needs to be applied here as well (which at that time should exist in the clients repo, this is just temporarily here for testing)
  // once the previously described workflow is finished, the SVT will need to explicity call this and pass a test account token when a standalone imodel is opened as a workaround,
  // for electron apps, there will need to be a mechanism to prompt the user to sign in when opening a local imodels from the disk that has reality tiles referenced in it
  public static async setToken(token?: AccessToken) {
    if (undefined !== token) {
      RealityModelTileClient.token = token;
    } else if (undefined === RealityModelTileClient.token) {
      // ###TODO for testing purposes, we are hardcoding a test user's credentials to generate a token that can access the reality tiles
      const authToken: AuthorizationToken | undefined = await (new ImsActiveSecureTokenClient("QA")).getToken("Regular.IModelJsTestUser@mailinator.com", "Regular@iMJs");
      RealityModelTileClient.token = await RealityModelTileClient.client.getAccessToken(authToken);
    }
  }

  // this is only used for accessing locally served reality tiles.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    urlParts.pop();
    this.baseUrl = urlParts.join("/") + "/";
  }

  public async getRootDocument(url: string): Promise<any> {
    if (undefined !== this.rdsProps && undefined !== RealityModelTileClient.token)
      return RealityModelTileClient.client.getRootDocumentJson(RealityModelTileClient.token, this.rdsProps.projectId, this.rdsProps.tilesId);
    this.setBaseUrl(url);
    return getJson(url);
  }

  public async getTileContent(url: string): Promise<any> {
    if (undefined !== this.rdsProps && undefined !== RealityModelTileClient.token)
      return RealityModelTileClient.client.getTileContent(RealityModelTileClient.token, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    if (undefined !== this.baseUrl) {
      const tileUrl = this.baseUrl + url;
      return getArrayBuffer(tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data content url");
  }

  public async getTileJson(url: string): Promise<any> {
    if (undefined !== this.rdsProps && undefined !== RealityModelTileClient.token)
      return RealityModelTileClient.client.getTileJson(RealityModelTileClient.token, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    if (undefined !== this.baseUrl) {
      const tileUrl = this.baseUrl + url;
      return getJson(tileUrl);
    }
    throw new IModelError(BentleyStatus.ERROR, "Unable to determine reality data json url");
  }
}
