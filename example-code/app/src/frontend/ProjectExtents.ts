/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle } from "@bentley/geometry-core";
import { Cartographic, Frustum } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";

export class ProjectExtentsExample {
  // __PUBLISH_EXTRACT_START__ ProjectExtents_toCartographic

  /** get a 5 point shape of Cartographic points that encloses the project on the ground plane. */
  public async convertExtentsToCartographicShape(iModel: IModelConnection): Promise<Cartographic[]> {
    const shape: Cartographic[] = [];

    // convert extents to an 8 point array
    const pts = Frustum.fromRange(iModel.projectExtents).points;

    // the first 4 points are on the front plane
    for (let i = 0; i < 4; ++i) {
      shape[i] = await iModel.spatialToCartographic(pts[i]);
      shape[i].height = 0; // set at ground level
    }

    shape[4] = shape[0]; // close shape
    return shape;
  }

  /** get the low and high Cartographic range of this iModel */
  public async getProjectMinMaxCartographic(iModel: IModelConnection) {
    let low: Cartographic | undefined;
    let high: Cartographic | undefined;

    const pts = Frustum.fromRange(iModel.projectExtents).points;
    for (const pt of pts) {
      const geoPt = await iModel.spatialToCartographic(pt);
      if (undefined === low || undefined === high) {
        low = geoPt;
        high = geoPt.clone();
        continue;
      }
      low.latitude = Angle.fromJSON({radians: Math.min(low.latitudeRadians, geoPt.latitudeRadians)});
      low.longitude = Angle.fromJSON({radians: Math.min(low.longitudeRadians, geoPt.longitudeRadians)});
      low.height = Math.min(low.height, geoPt.height);
      high.latitude = Angle.fromJSON({radians: Math.max(high.latitudeRadians, geoPt.latitudeRadians)});
      high.longitude = Angle.fromJSON({radians: Math.max(high.longitudeRadians, geoPt.longitudeRadians)});
      high.height = Math.max(high.height, geoPt.height);
    }

    return { min: low!, max: high! };
  }

  // __PUBLISH_EXTRACT_END__
}
