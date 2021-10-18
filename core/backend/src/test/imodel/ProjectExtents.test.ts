/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { GeometricElement3dProps, Placement3d } from "@itwin/core-common";
import { GeometricElement3d, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../index";

describe("computeProjectExtents", () => {
  let imodel: SnapshotDb;

  before(() => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(() => {
    imodel.close();
  });

  it("should return requested information", () => {
    const projectExtents = imodel.projectExtents;
    const args = [undefined, false, true];
    for (const reportExtentsWithOutliers of args) {
      for (const reportOutliers of args) {
        const result = imodel.computeProjectExtents({ reportExtentsWithOutliers, reportOutliers });
        expect(result.extents.isAlmostEqual(projectExtents)).to.be.true;

        expect(undefined !== result.extentsWithOutliers).to.equal(true === reportExtentsWithOutliers);
        if (undefined !== result.extentsWithOutliers)
          expect(result.extentsWithOutliers.isAlmostEqual(projectExtents)).to.be.true;

        expect(undefined !== result.outliers).to.equal(true === reportOutliers);
        if (undefined !== result.outliers)
          expect(result.outliers.length).to.equal(0);
      }
    }
  });

  it("should report outliers", () => {
    const elemProps = imodel.elements.getElementProps<GeometricElement3dProps>({ id: "0x39", wantGeometry: true });
    elemProps.id = Id64.invalid;
    const placement = Placement3d.fromJSON(elemProps.placement);
    const originalOrigin = placement.origin.clone();
    const mult = 1000000;
    placement.origin.x *= mult;
    placement.origin.y *= mult;
    placement.origin.z *= mult;
    elemProps.placement = placement;
    elemProps.geom![2].sphere!.radius = 0.000001;
    const newId = imodel.elements.insertElement(elemProps);
    expect(Id64.isValid(newId)).to.be.true;
    imodel.saveChanges();

    const newElem = imodel.elements.getElement<GeometricElement3d>(newId);
    expect(newElem).instanceof(GeometricElement3d);
    expect(newElem.placement.origin.x).to.equal(originalOrigin.x * mult);
    expect(newElem.placement.origin.y).to.equal(originalOrigin.y * mult);
    expect(newElem.placement.origin.z).to.equal(originalOrigin.z * mult);

    const outlierRange = placement.calculateRange();
    const originalExtents = imodel.projectExtents;
    const extentsWithOutlier = originalExtents.clone();
    extentsWithOutlier.extendRange(outlierRange);

    const result = imodel.computeProjectExtents({ reportExtentsWithOutliers: true, reportOutliers: true });
    expect(result.outliers!.length).to.equal(1);
    expect(result.outliers![0]).to.equal(newId);
    expect(result.extents.isAlmostEqual(originalExtents)).to.be.true;
    expect(result.extentsWithOutliers!.isAlmostEqual(originalExtents)).to.be.false;
    expect(result.extentsWithOutliers!.low.isAlmostEqual(extentsWithOutlier.low)).to.be.true;
    expect(result.extentsWithOutliers!.high.isAlmostEqual(extentsWithOutlier.high, 20)).to.be.true;
  });
});
