/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { Element, GeometricElement3d, PhysicalPartition, SnapshotDb } from "@itwin/core-backend";
import { QueryBinder } from "@itwin/core-common";
import { IModelTestUtils } from "./IModelTestUtils";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Useful ECSQL spatial queries", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = IModelTestUtils.openSnapshotFromSeed("test.bim");
  });

  after(() => {
    iModel.close();
  });

  it("should execute spatial queries", () => {
    let modelId: Id64String | undefined;
    for (const eidStr of iModel.queryEntityIds({ from: PhysicalPartition.classFullName, where: "CodeValue='Physical'" })) {
      modelId = iModel.models.getSubModel(Id64.fromString(eidStr)).id;
    }
    assert(modelId !== undefined);
    if (modelId === undefined)
      return;

    // __PUBLISH_EXTRACT_START__ EcsqlGeometryFunctions.iModel_bbox_areaxy
    // Compute the largest element area in the X-Y plane.
    let maxArea: number = 0;
    iModel.withQueryReader(`SELECT iModel_bbox_areaxy(iModel_bbox(BBoxLow.X,BBoxLow.Y,BBoxLow.Z,BBoxHigh.X,BBoxHigh.Y,BBoxHigh.Z)) FROM ${GeometricElement3d.classFullName}`,
      (reader) => {
        while (reader.step()) {
          const thisArea: number = reader.current[0];
          if (thisArea > maxArea)
            maxArea = thisArea;
        }
      });
    // Report the result
    reportArea(maxArea);

    // Use the standard SUM operator to accumulate the results of the iModel_bbox_areaxy function. This shows that
    // ECSQL treats the built-in geometry functions as normal expressions.
    const areaSum: number = iModel.withQueryReader(`SELECT SUM(iModel_bbox_areaxy(iModel_bbox(BBoxLow.X,BBoxLow.Y,BBoxLow.Z,BBoxHigh.X,BBoxHigh.Y,BBoxHigh.Z))) FROM ${GeometricElement3d.classFullName}`,
      (reader) => {
        if (!reader.step())
          throw new Error("Expected aggregate query to return one row");
        return reader.current[0];
      });
    // Report the result
    reportArea(areaSum);

    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ EcsqlGeometryFunctions.iModel_bbox_union
    // This is an example of accumulating the union of bounding boxes.
    const bboxUnionStmtECSQL = `
      SELECT
        iModel_bbox_union(
          iModel_placement_aabb(
            iModel_placement(
              iModel_point(g.Origin.X, g.Origin.Y, g.Origin.Z),
              iModel_angles(g.Yaw, g.Pitch, g.Roll),
              iModel_bbox(g.BBoxLow.X, g.BBoxLow.Y, g.BBoxLow.Z, g.BBoxHigh.X, g.BBoxHigh.Y, g.BBoxHigh.Z)
            )
          )
        )
      FROM ${Element.classFullName} AS e, ${GeometricElement3d.classFullName} AS g
        WHERE e.model.id=? AND e.ecinstanceid=g.ecinstanceid
    `;

    const rangeSum: Range3dProps = iModel.withQueryReader(bboxUnionStmtECSQL,
      (reader) => {
        if (!reader.step())
          throw new Error("Expected aggregate query to return one row");
        // Note that the the ECSQL value is a blob. Its data must be extracted and interpreted as a Range3d.
        return Range3d.fromArrayBuffer(reader.current[0].buffer);
      }, new QueryBinder().bindId(1, modelId));
    reportRange(rangeSum);
    // __PUBLISH_EXTRACT_END__

    // This is an example of passing the WRONG TYPE of object to iModel_bbox_areaxy and getting an error.
    // This statement is wrong, because iModel_placement_angles returns a iModel_angles object, while iModel_bbox_areaxy expects a DGN_bbox object.
    // Note that the error is detected when you try to step the statement, not when you prepare it.
    assert.throws(() => iModel.withQueryReader(
      `SELECT iModel_bbox_areaxy(iModel_angles(Yaw,Pitch,Roll)) FROM ${GeometricElement3d.classFullName}`,
      (reader) => {
        while (reader.step()) {
          // The invalid argument type is detected while stepping.
        }
      },
    ), "Step failed with code 1");
  });

});

function reportArea(a: number) {
  a;
}
function reportRange(a: Range3dProps) {
  a;
}
