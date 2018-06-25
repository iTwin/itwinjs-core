/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { } from "./TileTree";
import { ElementProps, RelatedElement, TileTreeProps, TileProps, TileId, IModelError } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Id64Props, Id64, BentleyStatus } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d, RotMatrix, XYZ, PointString3d } from "@bentley/geometry-core";
import { request, RequestOptions } from "@bentley/imodeljs-clients";

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
    const minToleranceRatio = 256.0;   // Nominally the screen size of a tile.  Increasing generally increases performance (fewer draw calls) at expense of higher load times.
    return minToleranceRatio * range.diagonal().magnitude() / geometricError;
  }
  export function transformFromJson(jTrans: [] | undefined): TransformProps | undefined {
    if (jTrans === undefined || !jTrans instanceof Array)
      return undefined;

    return Transform.createOriginAndMatrix(Point3d.create(jTrans[12], jTrans[13], jTrans[14), RotMatrix.createRowValues(jTrans[0], jTrans[4], jTrans[9], jTrans[1], jTrans[5], jTrans[10], jTrans[2], jTrans[6], jTrans[11])).toJSON();
  }
}

export class ScalableMeshTileTreeProps implements TileTreeProps {
  public id: Id64Props = "";
  public rootTile: TileProps;
  public location: TransformProps;
  public tilesetJson: object;
  constructor(json: any) {
    this.tilesetJson = json.root;
    this.id = new Id64();
    this.rootTile = new ScalableMeshTileProps(json.root, "");
    this.location = CesiumUtils.transformFromJson(json.root.transf);
  }
}

class ScalableMeshTileProps implements TileProps {
  public id: TileId;
  public range: Range3dProps;
  public maximumSize: number;
  public childIds: string[];
  constructor(json: any, parentId: string) {
    this.id = new TileId(new Id64(), undefined === json.content ? "" : json.content.url);
    this.range = CesiumUtils.rangeFromBoundingVolume(json.boundingVolume);
    this.maximumSize = 256.0; // CesiumUtils.maximumSizeFromGeometricTolerance(Range3d.fromJSON(this.range), json.geometricError);
    this.childIds = [];
    const prefix = parentId.length ? parentId + "_" : "";
    for (let i = 0; i < json.children.length; i++)
      this.childIds.push(prefix + i);
  }
}

function findTileInJson(tilesetJson: any, id: string, parentId: string): ScalableMeshTileProps | undefined {
  const separatorIndex = id.indexOf("_");
  const childId = (separatorIndex < 0) ? id : id.substring(0, separatorIndex - 1);
  const childIndex = parseInt(childId, 10);

  if (isNaN(childIndex) || tilesetJson === undefined || tilesetJson.children === undefined || childIndex >= tilesetJson.children.length)
    return undefined;
  const foundChild = tilesetJson.children[childIndex];
  const thisParentId = parentId.length ? (parentId + "_" + childId) : childId;
  if (separatorIndex < 0) { return new ScalableMeshTileProps(foundChild, thisParentId); }

  return findTileInJson(foundChild, id.substring(separatorIndex), thisParentId);
}
export class ScalableMeshTileLoader {
  constructor(private tilesetJson: object) { }

  public async getTileProps(tileIds: string[]): Promise<TileProps[]> {
    const props: ScalableMeshTileProps[] = [];
    for (const tileId of tileIds) {
      const tile = findTileInJson(this.tilesetJson, tileId, "");
      if (tile !== undefined)
        props.push(tile);
    }
    return props;
  }
}

export namespace ScalableMeshTileTree {
  export async function getTileTreeProps(modeledElement: RelatedElement, iModel: IModelConnection): Promise<ScalableMeshTileTreeProps> {

    const result: ElementProps[] = await iModel.elements.getProps(modeledElement.id);
    const options: RequestOptions = {
      method: "GET",
      responseType: "json",
      auth: { user: "bistroQA_test1@mailinator.com", password: "test1" },
    };

    let url = result[0].url;
    // TBD.... Figure out how to authenticate client for RealityDataService.
    // url = "http://realitymodeling-pw.bentley.com/a3D/Cesium/Philadelphia/PhiladelphiaHiResRealityModelWithComcast/ComcastMerged_20.json";
    url = "http://realitymodeling-pw.bentley.com/a3D/Cesium/TigerCapture/Model_28/Model_28.json";   // Testing...
    const data = await request(url, options);
    const ecefLocation = iModel.ecefLocation;
    if (undefined === ecefLocation) { }

    if (null === data.body)
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");

    return new ScalableMeshTileTreeProps(data.body);
  }
}
