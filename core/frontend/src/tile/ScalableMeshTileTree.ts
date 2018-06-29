/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { } from "./TileTree";
import { ElementProps, RelatedElement, TileTreeProps, TileProps, TileId, IModelError } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Id64Props, Id64, BentleyStatus, assert } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core";
import { RealityDataServicesClient, AuthorizationToken, AccessToken } from "@bentley/imodeljs-clients";
import { TestConfig, TestUsers } from "@bentley/imodeljs-clients/lib/test/TestConfig";

namespace CesiumUtils {
  export function rangeFromBoundingVolume(boundingVolume: any): Range3d {
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
  export function maximumSizeFromGeometricTolerance(range: Range3d, geometricError: number): number {
    const minToleranceRatio = .5;   // Nominally the error on screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  export function transformFromJson(jTrans: number[] | undefined): Transform {
    return (jTrans === undefined) ? Transform.createIdentity() : Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14]), RotMatrix.createRowValues(jTrans[0], jTrans[4], jTrans[9], jTrans[1], jTrans[5], jTrans[10], jTrans[2], jTrans[6], jTrans[11]));
  }
}

export class ScalableMeshTileTreeProps implements TileTreeProps {
  public id: Id64Props = "";
  public rootTile: TileProps;
  public location: TransformProps;
  public tilesetJson: object;
  public yAxisUp: boolean = false;
  constructor(json: any, public client: RealityDataServicesClient, public accessToken: AccessToken, public projectId: string, public tilesId: string, ecefToDb: Transform) {
    this.tilesetJson = json.root;
    this.id = new Id64();
    this.rootTile = new ScalableMeshTileProps(json.root, "", this, undefined);
    const tileToEcef = CesiumUtils.transformFromJson(json.root.transf);
    const tileToDb = Transform.createIdentity();
    tileToDb.setMultiplyTransformTransform(ecefToDb, tileToEcef);
    this.location = tileToDb.toJSON();
    if (json.asset.gltfUpAxis === undefined || json.asset.gltfUpAxis === "y")
      this.yAxisUp = true;
  }
}

class ScalableMeshTileProps implements TileProps {
  public id: TileId;
  public range: Range3dProps;
  public contentRange?: Range3dProps;
  public maximumSize: number;
  public childIds: string[];
  public geometry?: string | ArrayBuffer;
  public yAxisUp: boolean;
  constructor(json: any, thisId: string, public tree: ScalableMeshTileTreeProps, geometry: ArrayBuffer | undefined) {
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

export class ScalableMeshTileLoader {
  constructor(private tree: ScalableMeshTileTreeProps) { }

  public async getTileProps(tileIds: string[]): Promise<TileProps[]> {
    const props: ScalableMeshTileProps[] = [];
    await Promise.all(tileIds.map(async (tileId) => {
      const tile = await this.findTileInJson(this.tree.tilesetJson, tileId, "");
      if (tile !== undefined)
        props.push(tile);
    }));
    return props;
  }
  private async findTileInJson(tilesetJson: any, id: string, parentId: string): Promise<ScalableMeshTileProps | undefined> {
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
    if (foundChild.content.url.endsWith("json")) {
      const subTree = await this.tree.client.getTileJson(this.tree.accessToken, this.tree.projectId, this.tree.tilesId, foundChild.content.url);
      foundChild = subTree.root;
      tilesetJson.children[childIndex] = subTree.root;
    }

    const content = await this.tree.client.getTileContent(this.tree.accessToken, this.tree.projectId, this.tree.tilesId, foundChild.content.url);
    assert(content !== undefined, "scalable mesh tile content not found.");
    return new ScalableMeshTileProps(foundChild, thisParentId, this.tree, content);
  }
}

export namespace ScalableMeshTileTree {
  export async function getTileTreeProps(modeledElement: RelatedElement, iModel: IModelConnection): Promise<ScalableMeshTileTreeProps> {
    const result: ElementProps[] = await iModel.elements.getProps(modeledElement.id);
    const url = result[0].url;
    const ecefLocation = iModel.ecefLocation;
    let ecefToDb: Transform = Transform.createIdentity();

    if (ecefLocation !== undefined) {
      const dbToEcef = Transform.createOriginAndMatrix(ecefLocation.origin, ecefLocation.orientation.toRotMatrix());
      ecefToDb = dbToEcef.inverse() as Transform;
    }

    if (undefined !== url) {
      // ###TODO determine apropriate way to get token (probably from the imodel, but for standalone testing a workaround is needed)
      const authToken: AuthorizationToken = await TestConfig.login(TestUsers.regular);
      const realityDataServiceClient: RealityDataServicesClient = new RealityDataServicesClient("QA");
      const accessToken: AccessToken = await realityDataServiceClient.getAccessToken(authToken);
      const projectId = url.split("/").find((val: string) => val.includes("--"))!.split("--")[1];
      const tilesId = url.split("/").find((val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
      const json = await realityDataServiceClient.getTileJsonFromUrl(accessToken, url);

      return new ScalableMeshTileTreeProps(json, realityDataServiceClient, accessToken, projectId, tilesId, ecefToDb);
    } else {
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");
    }
  }
}
