/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartographic, Frustum } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

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
      low.latitude = Math.min(low.latitude, geoPt.latitude);
      low.longitude = Math.min(low.longitude, geoPt.longitude);
      low.height = Math.min(low.height, geoPt.height);
      high.latitude = Math.max(high.latitude, geoPt.latitude);
      high.longitude = Math.max(high.longitude, geoPt.longitude);
      high.height = Math.max(high.height, geoPt.height);
    }

    return { min: low!, max: high! };
  }

  // __PUBLISH_EXTRACT_END__
}
