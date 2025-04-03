/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { RelatedElement, DrawingProps } from "@itwin/core-common";
import { Drawing } from "../../Element";
import { DocumentListModel, DrawingModel } from "../../Model";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Drawing", () => {
  let imodel: SnapshotDb;
  let documentListModelId: string;

  before(() => {
    const iModelPath = IModelTestUtils.prepareOutputFile("Drawing", "Drawing.bim");
    imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "DrawingTest" } });
    documentListModelId = DocumentListModel.insert(imodel, SnapshotDb.rootSubjectId, "DocumentList");
  });

  after(() => {
    imodel.close();
  });
  
  describe("scaleFactor", () => {
    it("defaults to 1", () => {
      
    });

    it("throws when attempting to set to zero", () => {
      
    });

    it("is omitted from JSON if set to 1", () => {
      
    });

    it("is preserved when round-tripped", () => {
      
    });

    it("defaults to 1 if persisted as zero", () => {
      
    });
  });

  describe("insert", () => {
    it("throws if scaleFactor is zero", () => {
      
    });

    it("defaults scaleFactor to 1", () => {
      
    });

    it("preserves scaleFactor", () => {
      
    });
  });
});
