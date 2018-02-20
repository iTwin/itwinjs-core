/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GraphicBuilderTileCorners } from "../../frontend/render/GraphicBuilder";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";

describe.only("GraphicBuilderTileCorners", () => {
  it("works as expected", () => {
    const corners = [ new Point3d(0, 1, 2), new Point3d(3, 4, 5), new Point3d(6, 7, 8), new Point3d(9, 10, 11) ];
    const tileCorners = new GraphicBuilderTileCorners([ new Point3d(0, 1, 2), new Point3d(3, 4, 5), new Point3d(6, 7, 8), new Point3d(9, 10, 11) ]);
    let key = 0;
    for (const p of tileCorners) { assert.isTrue(corners[key].isExactEqual(p)); key++; }
  });
});
