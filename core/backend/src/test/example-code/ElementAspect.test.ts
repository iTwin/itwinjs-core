/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModel } from "@itwin/core-common";
import { ElementAspect, ElementMultiAspect, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ElementAspect examples", () => {
  let iModelDb: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("ElementAspectTest.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ElementAspectExamples", "ElementAspectTest.bim");
    iModelDb = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => iModelDb.close());

  it("streams aspects for multiple elements", async () => {
    const elementIds = ["0x17", IModel.rootSubjectId];
    const processedAspects: ElementAspect[] = [];
    const processAspect = (aspect: ElementAspect) => processedAspects.push(aspect);

    // __PUBLISH_EXTRACT_START__ CoreBackend.IModelDb.GetAspectsForElements
    for await (const aspect of iModelDb.elements.getAspectsForElements({
      elementIds,
      aspectClassFullName: ElementMultiAspect.classFullName,
      groupByOwner: true,
    })) {
      processAspect(aspect);
    }
    // __PUBLISH_EXTRACT_END__

    assert.lengthOf(processedAspects, 4);
  });
});
