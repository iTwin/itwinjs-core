/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { TileTreeProps, TileProps, TileId, IModelError } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Id64Props, Id64, BentleyStatus, assert, StopWatch, Guid } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core";
import { RealityDataServicesClient, AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, getArrayBuffer, getJson } from "@bentley/imodeljs-clients";
import { SpatialModelState } from "../ModelState";
import { TileTree } from "./TileTree";
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

class RealityModelTileLoader {
  constructor(private tree: RealityModelTileTreeProps) { }
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
      const urlParts = url.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
      const tilesId = urlParts.find(Guid.isGuid);

      let clientProps: RDSClientProps | undefined;

      if (undefined !== tilesId) {
        // ###TODO determine appropriate way to get token (probably from the imodel, but for standalone testing a workaround is needed)
        const authToken: AuthorizationToken | undefined = await (new ImsActiveSecureTokenClient("QA")).getToken("Regular.IModelJsTestUser@mailinator.com", "Regular@iMJs");
        const client: RealityDataServicesClient = new RealityDataServicesClient("QA");
        const accessToken: AccessToken = await client.getAccessToken(authToken);
        let projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];

        // ##TODO This is a temporary workaround for accessing the reality meshes with a test account
        if (projectId === "Server")
          projectId = "fb1696c8-c074-4c76-a539-a5546e048cc6";

        clientProps = { accessToken, projectId, tilesId, client };
      }

      const tileClient = new RealityModelTileClient(clientProps);
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
  accessToken: AccessToken;
  projectId: string;
  tilesId: string;
  client: RealityDataServicesClient;
}

class RealityModelTileClient {
  public rdsProps?: RDSClientProps;
  constructor(props?: RDSClientProps) { this.rdsProps = props; }

  public async getRootDocument(url: string): Promise<any> {
    if (undefined !== this.rdsProps)
      return this.rdsProps.client.getRootDocumentJson(this.rdsProps.accessToken, this.rdsProps.projectId, this.rdsProps.tilesId);
    return getJson(url);
  }

  public async getTileContent(url: string): Promise<any> {
    if (undefined !== this.rdsProps)
      return this.rdsProps.client.getTileContent(this.rdsProps.accessToken, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    return getArrayBuffer(url);
  }

  public async getTileJson(url: string): Promise<any> {
    if (undefined !== this.rdsProps)
      return this.rdsProps.client.getTileJson(this.rdsProps.accessToken, this.rdsProps.projectId, this.rdsProps.tilesId, url);
    return getJson(url);
  }
}
