/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as chaiJestSnapshot from "chai-jest-snapshot";
import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Content sources", ({ getDefaultSuiteIModel }) => {
  it("retrieves content sources for given class", async function () {
    // we want to compare against the same snapshot - that requires reconfiguring chai-jest-snapshot by resetting it's config
    // and supplying file name and snapshot name to `matchSnapshot`. otherwise each call to `matchSnapshot` generates a new snapshot
    // in the snapshot file.
    chaiJestSnapshot.setFilename("");
    chaiJestSnapshot.setTestName("");
    const snapshotFilePath = `${this.test!.file!.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "")}.snap`;
    const snapshotName = this.test!.fullTitle();

    const imodel = await getDefaultSuiteIModel();
    let sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJ_TestSchema.TestClass"] });
    expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

    sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJ_TestSchema:TestClass"] });
    expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

    sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJTest.TestClass"] });
    expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

    sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJTest:TestClass"] });
    expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);
  });
});
