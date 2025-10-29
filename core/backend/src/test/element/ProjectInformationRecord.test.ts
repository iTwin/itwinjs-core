/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelTestUtils } from "../IModelTestUtils";
import { SnapshotDb } from "../../IModelDb";
import { IModel, ProjectInformation } from "@itwin/core-common";
import { ProjectInformationRecord } from "../../Element";

describe.only("ProjectInformationRecord", () => {
  describe("with BisCore < 00.01.25", () => {
    let db: SnapshotDb;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("mirukuru.ibim");
      const testFileName = IModelTestUtils.prepareOutputFile("ProjectInformationRecord", "ProjectInformationRecordTest.bim");
      db = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    });

    after(() => db.close());

    it("throws", () => {
      const projectProps: ProjectInformation = {
        projectNumber: "num",
        projectName: "name",
        location: "place",
      };

      expect(() => ProjectInformationRecord.create({
        iModel: db,
        parentSubjectId: IModel.rootSubjectId,
        ...projectProps,
      })).to.throw("ProjectInformationRecord requires BisCore v01.00.25 or newer");
    });
  });

  describe("with BisCore >= 00.01.25", () => {
    it("inserts", () => {

    })

    it("throws if parent is not a Subject", () => {

    });

    it("creates SubjectOwnsProjectInformationRecord relationships", () => {

    });
  });
});
