/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d } from "@bentley/geometry-core";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";

describe("IModelConnection", () => {
  describe("displayed extents", () => {
    const defaultExtents = new Range3d(0, 0, 0, 1, 1, 1);
    let imodel: IModelConnection;

    before(async () => IModelApp.startup());
    beforeEach(() => imodel = createBlankConnection(undefined, undefined, defaultExtents));
    afterEach(async () => imodel.close());
    after(async () => IModelApp.shutdown());

    it("is initialized to project extents", () => {
      expect(imodel.displayedExtents.isAlmostEqual(imodel.projectExtents)).to.be.true;
    });

    it("expands", () => {
      imodel.expandDisplayedExtents(new Range3d(0, -1, 1, 2, 0, 1));
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(0, -1, 0, 2, 1, 1))).to.be.true;
      imodel.expandDisplayedExtents(new Range3d(-100, 0, 0, 0, 0, 100));
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, -1, 0, 2, 1, 100))).to.be.true;
    });

    it("doesn't contract", () => {
      imodel.expandDisplayedExtents(new Range3d(0, 0.5, 1, 1, 0.5, 0));
      expect(imodel.displayedExtents.isAlmostEqual(imodel.projectExtents)).to.be.true;
    });

    it("updates when project extents change", () => {
      imodel.expandDisplayedExtents(new Range3d(-100, 0, 0, 100, 0, 0));
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, 0, 0, 100, 1, 1))).to.be.true;
      imodel.projectExtents = new Range3d(0, -10, 0, 200, 0, 50);
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, -10, 0, 200, 0, 50))).to.be.true;
    });
  });
});
