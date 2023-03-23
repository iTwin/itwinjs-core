/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";
import { EmptyLocalization } from "@itwin/core-common";

describe("IModelConnection", () => {
  describe("displayed extents", () => {
    const defaultExtents = new Range3d(0, 0, 0, 1, 1, 1);
    let imodel: IModelConnection;

    before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
    beforeEach(() => imodel = createBlankConnection(undefined, undefined, defaultExtents));
    afterEach(async () => imodel.close());
    after(async () => IModelApp.shutdown());

    it("is initialized to project extents", () => {
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(imodel.projectExtents)).to.be.true;
    });

    it("expands", () => {
      /* eslint-disable-next-line deprecation/deprecation */
      imodel.expandDisplayedExtents(new Range3d(0, -1, 1, 2, 0, 1));
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(0, -1, 0, 2, 1, 1))).to.be.true;
      /* eslint-disable-next-line deprecation/deprecation */
      imodel.expandDisplayedExtents(new Range3d(-100, 0, 0, 0, 0, 100));
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, -1, 0, 2, 1, 100))).to.be.true;
    });

    it("doesn't contract", () => {
      /* eslint-disable-next-line deprecation/deprecation */
      imodel.expandDisplayedExtents(new Range3d(0, 0.5, 1, 1, 0.5, 0));
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(imodel.projectExtents)).to.be.true;
    });

    it("updates when project extents change", () => {
      /* eslint-disable-next-line deprecation/deprecation */
      imodel.expandDisplayedExtents(new Range3d(-100, 0, 0, 100, 0, 0));
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, 0, 0, 100, 1, 1))).to.be.true;
      imodel.projectExtents = new Range3d(0, -10, 0, 200, 0, 50);
      /* eslint-disable-next-line deprecation/deprecation */
      expect(imodel.displayedExtents.isAlmostEqual(new Range3d(-100, -10, 0, 200, 0, 50))).to.be.true;
    });
  });
});
