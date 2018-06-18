/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { } from "./TileTree";
import { ElementProps, RelatedElement, TileTreeProps, TileProps, TileId, IModelError } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { Id64Props, Id64, BentleyStatus } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps, Range3d, Transform, Point3d, Vector3d } from "@bentley/geometry-core";
import { request, RequestOptions } from "@bentley/imodeljs-clients";
namespace CesiumUtils {

  export function rangeFromBoundingVolume(boundingVolume: any): Range3d {
    const box: number[] = boundingVolume.box;
    const center = Point3d.create(box[0], box[1], box[2]);
    const ux = Vector3d.create(box[3], box[4], box[5]);
    const uy = Vector3d.create(box[6], box[7], box[8]);
    const uz = Vector3d.create(box[9], box[10], box[11]);
    const corners: Point3d[] = [];
    let i = 0;
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        for (let l = 0; l < 2; l++) {
          corners[i] = center.plus(j ? ux : ux.negate());
          corners[i] = center.plus(k ? uy : uy.negate());
          corners[i] = center.plus(l ? uz : uz.negate());
          i++;
        }
      }
    }
    return Range3d.createArray(corners);
  }
}

class ScalableMeshTileTreeProps implements TileTreeProps {
  public id: Id64Props = "";
  public rootTile: TileProps;
  public location: TransformProps;
  constructor(json: any) {
    this.id = new Id64();
    this.rootTile = new ScalableMeshTileProps(json.root);
    this.location = Transform.createIdentity();
  }
}

class ScalableMeshTileProps implements TileProps {
  public id: TileId;
  public range: Range3dProps;
  public maximumSize: number = 0;
  public childIds: string[];
  constructor(json: any) {
    this.id = new TileId(new Id64(), undefined === json.content ? "" : json.content.url.asString());
    this.range = CesiumUtils.rangeFromBoundingVolume(json.boundingVolume);
    this.childIds = [];
    for (const content of json.children) {
      this.childIds.push(content.url);
    }
  }
}

export class ScalableMeshTileTree {
  public static async getTileTreeProps(modeledElement: RelatedElement, iModel: IModelConnection): Promise<TileTreeProps> {

    const result: ElementProps[] = await iModel.elements.getProps(modeledElement.id);
    const options: RequestOptions = {
      method: "GET",
      responseType: "json",
    };

    let url = result[0].url;
    // TBD.... Figure out how to authenticate client for RealityDataService.
    url = "http://realitymodeling-pw.bentley.com/a3D/Cesium/Philadelphia/PhiladelphiaHiResRealityModelWithComcast/ComcastMerged_20.json";
    const data = await request(url, options);

    if (undefined === data.body)
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");

    return new ScalableMeshTileTreeProps(data.body);
  }
}
