/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DefinitionModel, SpatialCategory, StandaloneDb, TxnIdString } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect } from "chai";
import { DrawingProvenance } from "./DrawingProvenance";
import { Id64, Id64String } from "@itwin/core-bentley";
import { IModel, SubCategoryAppearance } from "@itwin/core-common";

describe.only("DrawingProvenance", () => {
  let db: StandaloneDb;
  let definitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let initialTxnId: TxnIdString;

  before(async () => {
    db = IModelTestUtils.openIModelForWrite("test.bim", { copyFilename: "DrawingMonitor.bim", upgradeStandaloneSchemas: true });
    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);

    definitionModelId = DefinitionModel.insert(db, IModel.rootSubjectId, "DrawingProvenance");
    spatialCategoryId = SpatialCategory.insert(db, definitionModelId, "SpatialCategory", new SubCategoryAppearance());

    db.saveChanges();
    initialTxnId = db.txns.getCurrentTxnId();
  });

  afterEach(() => {
    db.txns.reverseTo(initialTxnId);
  });

  after(() => db.close());

  function insertSpatialModel(): Id64String {
    const model = IModelTestUtils.createAndInse
  }

  describe("compute", () => {
    it("produces a sorted list of the geometry GUIDs of all the models viewed by a spatial view", () => {

    });
  });

  describe("query", () => {
    it("returns the provenance if present", () => {

    });

    it("returns undefined if the specified Id does not identify a SectionDrawing element", () => {
      expect(DrawingProvenance.query(Id64.invalid, db)).to.be.undefined;
      expect(DrawingProvenance.query(IModel.rootSubjectId, db)).to.be.undefined;
    });

    it("returns undefined if provenance is not present in jsonProperties", () => {

    });

    it("returns undefined in the event of an exception", () => {

    });
  });

  describe("remove", () => {
    it("deletes the provenance if present", () => {

    });

    it("does nothing if provenance is not present", () => {

    });

    it("throws if the specified SectionDrawing doesn't exist", () => {
      expect(() => DrawingProvenance.remove("0xdeadbeef", db)).to.throw();
      expect(() => DrawingProvenance.remove(Id64.invalid, db)).to.throw();
    });
  });

  describe("update", () => {
    it("updates the stored provenance with the newly-computed provenance", () => {

    });

    it("does nothing if the SectionDrawing has no associated spatial view", () => {

    });

    it("throws if the specified SectionDrawing does not exist", () => {
      expect(() => DrawingProvenance.update("0xdeadbeef", db)).to.throw();
      expect(() => DrawingProvenance.update(Id64.invalid, db)).to.throw();
    });
  });
});
