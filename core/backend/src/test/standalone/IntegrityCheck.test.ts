/* eslint-disable @typescript-eslint/naming-convention */
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { BriefcaseDb, IModelDb } from "../../IModelDb";
import { getIntegrityCheckName, performQuickIntegrityCheck, performSpecificIntegrityCheck, QuickIntegrityCheckResultRow } from "../../internal/IntegrityCheck";
import { DbResult, GuidString, Id64 } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubMock } from "../../internal/HubMock";
import { HubWrappers } from "../IModelTestUtils";
import { IModel, IModelError } from "@itwin/core-common";
import { _nativeDb, ChannelControl, Subject, SubjectOwnsSubjects } from "../../core-backend";

describe.only("Integrity Check Tests", () => {
let iModelStub: sinon.SinonStubbedInstance<IModelDb>;

  beforeEach(() => {
    iModelStub = sinon.createStubInstance(IModelDb);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getIntegrityCheckName", () => {
    it("should return the correct name for a valid check type", () => {
      expect(getIntegrityCheckName("checkDataColumns")).to.equal("Check Data Columns");
      expect(getIntegrityCheckName("checkECProfile")).to.equal("Check EC Profile");
      expect(getIntegrityCheckName("checkNavigationClassIds")).to.equal("Check Navigation Class Ids");
      expect(getIntegrityCheckName("checkNavigationIds")).to.equal("Check Navigation Ids");
      expect(getIntegrityCheckName("checkLinktableForeignKeyClassIds")).to.equal("Check Link Table Foreign Key Class Ids");
      expect(getIntegrityCheckName("checkLinktableForeignKeyIds")).to.equal("Check Link Table Foreign Key Ids");
      expect(getIntegrityCheckName("checkClassIds")).to.equal("Check Class Ids");
      expect(getIntegrityCheckName("checkDataSchema")).to.equal("Check Data Schema");
      expect(getIntegrityCheckName("checkSchemaLoad")).to.equal("Check Schema Load");
      expect(getIntegrityCheckName("checkMissingChildRows")).to.equal("Check Missing Child Rows");
    });

    it("should return the correct name when sqlCommand string is passed", () => {
      expect(getIntegrityCheckName("check_data_columns")).to.equal("Check Data Columns");
      expect(getIntegrityCheckName("check_ec_profile")).to.equal("Check EC Profile");
      expect(getIntegrityCheckName("check_nav_class_ids")).to.equal("Check Navigation Class Ids");
      expect(getIntegrityCheckName("check_nav_ids")).to.equal("Check Navigation Ids");
      expect(getIntegrityCheckName("check_linktable_fk_class_ids")).to.equal("Check Link Table Foreign Key Class Ids");
      expect(getIntegrityCheckName("check_linktable_fk_ids")).to.equal("Check Link Table Foreign Key Ids");
      expect(getIntegrityCheckName("check_class_ids")).to.equal("Check Class Ids");
      expect(getIntegrityCheckName("check_data_schema")).to.equal("Check Data Schema");
      expect(getIntegrityCheckName("check_schema_load")).to.equal("Check Schema Load");
      expect(getIntegrityCheckName("check_missing_child_rows")).to.equal("Check Missing Child Rows");
    });

    it("should return the input string if check type is not found", () => {
      expect(getIntegrityCheckName("unknownCheck")).to.equal("unknownCheck");
    });
  });

  describe("performQuickIntegrityCheck", () => {
    it("should return quick integrity check results", async () => {
      const mockResults = [
        { check: "check_data_columns", result: true, elapsed_sec: "0.5" },
        { check: "check_ec_profile", result: false, elapsed_sec: "0.3" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performQuickIntegrityCheck(iModelStub as any);

      expect(results).to.have.lengthOf(2);
      expect(results[0]).to.deep.include({ check: "Check Data Columns", passed: true, elapsedSeconds: "0.5" });
      expect(results[1]).to.deep.include({ check: "Check EC Profile", passed: false, elapsedSeconds: "0.3" });
    });

    it("should handle empty results", async () => {
      const asyncIterator = async function* () {};
      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performQuickIntegrityCheck(iModelStub as any);

      expect(results).to.be.an("array").that.is.empty;
    });
  });

  describe("performSpecificIntegrityCheck", () => {
    it("should return CheckDataColumnsResultRow for checkDataColumns", async () => {
      const mockResults = [
        { sno: 1, table: "ElementProps", column: "testColumn" },
        { sno: 2, table: "ElementTable", column: "missingColumn" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkDataColumns");

      expect(results).to.have.lengthOf(2);
      expect(results[0]).to.deep.equal({ sno: 1, table: "ElementProps", column: "testColumn" });
      expect(results[1]).to.deep.equal({ sno: 2, table: "ElementTable", column: "missingColumn" });
    });

    it("should return CheckECProfileResultRow for checkECProfile", async () => {
      const mockResults = [
        { sno: 1, type: "Schema", name: "BisCore", issue: "Invalid schema definition" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkECProfile");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, type: "Schema", name: "BisCore", issue: "Invalid schema definition" });
    });

    it("should return CheckNavClassIdsResultRow for checkNavigationClassIds", async () => {
      const mockResults = [
        { sno: 1, id: "1", class: "Element", property: "parent", nav_id: "2", nav_classId: "3" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkNavigationClassIds");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, id: "1", class: "Element", property: "parent", navId: "2", navClassId: "3" });
    });

    it("should return CheckNavIdsResultRow for checkNavigationIds", async () => {
      const mockResults = [
        { sno: 1, id: "1", class: "Element", property: "parent", nav_id: "2", primary_class: "Element" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkNavigationIds");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, id: "1", class: "Element", property: "parent", navId: "2", primaryClass: "Element" });
    });

    it("should return CheckLinkTableFkClassIdsResultRow for checkLinktableForeignKeyClassIds", async () => {
      const mockResults = [
        { sno: 1, id: "1", relationship: "ElementOwnsChildElements", property: "parent", key_id: "2", key_classId: "3" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkLinktableForeignKeyClassIds");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, id: "1", relationship: "ElementOwnsChildElements", property: "parent", keyId: "2", keyClassId: "3" });
    });

    it("should return CheckLinkTableFkIdsResultRow for checkLinktableForeignKeyIds", async () => {
      const mockResults = [
        { sno: 1, id: "1", relationship: "ElementOwnsChildElements", property: "parent", key_id: "2", primary_class: "Element" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkLinktableForeignKeyIds");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, id: "1", relationship: "ElementOwnsChildElements", property: "parent", keyId: "2", primaryClass: "Element" });
    });

    it("should return CheckClassIdsResultRow for checkClassIds", async () => {
      const mockResults = [
        { sno: 1, class: "Element", id: "1", class_id: "2", type: "Element" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkClassIds");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, class: "Element", id: "1", classId: "2", type: "Element" });
    });

    it("should return CheckDataSchemaResultRow for checkDataSchema", async () => {
      const mockResults = [
        { sno: 1, type: "Schema", name: "BisCore" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkDataSchema");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, type: "Schema", name: "BisCore" });
    });

    it("should return CheckSchemaLoadResultRow for checkSchemaLoad", async () => {
      const mockResults = [
        { sno: 1, schema: "BisCore" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkSchemaLoad");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, schema: "BisCore" });
    });

    it("should return CheckMissingChildRowsResultRow for checkMissingChildRows", async () => {
      const mockResults = [
        { sno: 1, class: "Element", id: "1", class_id: "2", MissingRowInTables: "ElementTable" },
      ];

      const asyncIterator = async function* () {
        for (const result of mockResults) {
          yield result;
        }
      };

      iModelStub.createQueryReader.returns(asyncIterator() as any);

      const results = await performSpecificIntegrityCheck(iModelStub as any, "checkMissingChildRows");

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ sno: 1, class: "Element", id: "1", classId: "2", missingRowInTables: "ElementTable" });
    });
  });
});

describe.only("iModelDb integrityCheck Tests", () => {
    let iTwinId: GuidString;
    let iModel: BriefcaseDb;

    before(() => {
      HubMock.startup("ChangesetReaderTest", KnownTestLocations.outputDir);
      iTwinId = HubMock.iTwinId;
    });

    after(() => HubMock.shutdown());

    beforeEach(async () => {
      // Create new iModel
      const adminToken = "super manager token";
      const iModelName = "PRAGMA_test";
      const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
      assert.isNotEmpty(iModelId);
      iModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: adminToken });
    });

    afterEach(() => {
      // Cleanup
      iModel.close();
    });

    it("should call integrityCheck on a new iModel and return no errors", async () => {
      const results = await iModel.integrityCheck();
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property("check").that.equals("Quick Check");
      expect(results[0]).to.have.property("passed").that.equals(true);
      expect(results[0]).to.have.property("results").that.is.an("array");
      expect(results[0].results.length).to.equal(9);
      assert(results[0].results.every((row) => (row as QuickIntegrityCheckResultRow).passed === true), "All specific checks should pass");
    });

    it("should call integrityCheck with no options selected and default to quick check", async () => {
      const results = await iModel.integrityCheck({});
      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.have.property("check").that.equals("Quick Check");
      expect(results[0]).to.have.property("passed").that.equals(true);
      expect(results[0].results.length).to.equal(9);

      const results2 = await iModel.integrityCheck({ quickCheck: false });
      expect(results2).to.have.lengthOf(1);
      expect(results2[0]).to.have.property("check").that.equals("Quick Check");
      expect(results2[0]).to.have.property("passed").that.equals(true);
      expect(results2[0].results.length).to.equal(9);

      const results3 = await iModel.integrityCheck({
        quickCheck: false,
        specificChecks: {
          checkDataColumns: false,
          checkECProfile: false,
          checkNavigationClassIds: false,
          checkNavigationIds: false,
          checkLinktableForeignKeyClassIds: false,
          checkLinktableForeignKeyIds: false,
          checkClassIds: false,
          checkDataSchema: false,
          checkSchemaLoad: false,
          checkMissingChildRows: false,
      }});
      expect(results3).to.have.lengthOf(1);
      expect(results3[0]).to.have.property("check").that.equals("Quick Check");
      expect(results3[0]).to.have.property("passed").that.equals(true);
      expect(results3[0].results.length).to.equal(9);
    });

    it("should throw an error when iModel is closed", async () => {
      iModel.close();

      try {
        await iModel.integrityCheck();
        assert.fail("Expected error was not thrown");
      } catch (error) {
        expect((error as IModelError).message).to.include("IModel is not open");
      }
    });

    it("should call integrityCheck on a new iModel and run all specific integrity checks and return no errors", async () => {
      const results = await iModel.integrityCheck({
        specificChecks: {
          checkDataColumns: true,
          checkECProfile: true,
          checkNavigationClassIds: true,
          checkNavigationIds: true,
          checkLinktableForeignKeyClassIds: true,
          checkLinktableForeignKeyIds: true,
          checkClassIds: true,
          checkDataSchema: true,
          checkSchemaLoad: true,
          checkMissingChildRows: true,
        },
      });
      expect(results).to.be.an("array");
      expect(results).to.have.lengthOf(10);

      // Verify each check is present and has the expected structure
      const checkNames = results.map((r) => r.check);
      expect(checkNames).to.include.members([
        "Check Data Columns",
        "Check EC Profile",
        "Check Navigation Class Ids",
        "Check Navigation Ids",
        "Check Link Table Foreign Key Class Ids",
        "Check Link Table Foreign Key Ids",
        "Check Class Ids",
        "Check Data Schema",
        "Check Schema Load",
        "Check Missing Child Rows",
      ]);

      // All checks should pass
      results.forEach((result) => {
        expect(result.passed).to.equal(true, `${result.check} should pass`);
        expect(result.results).to.be.empty;
      });
    });

    it("should call integrityCheck on an iModel with corrupt foreignKey Ids and return results", async () => {
      // Insert two elements
      iModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await iModel.locks.acquireLocks({ shared: IModel.repositoryModelId });

      const element1Id = iModel.elements.insertElement({
        classFullName: Subject.classFullName,
        model: IModel.repositoryModelId,
        parent: new SubjectOwnsSubjects(IModel.rootSubjectId),
        code: Subject.createCode(iModel, IModel.rootSubjectId, "Subject1"),
      });

      const element2Id = iModel.elements.insertElement({
        classFullName: Subject.classFullName,
        model: IModel.repositoryModelId,
        parent: new SubjectOwnsSubjects(IModel.rootSubjectId),
        code: Subject.createCode(iModel, IModel.rootSubjectId, "Subject2"),
      });
      iModel.saveChanges();

      // Create a relationship between them
      await iModel.locks.acquireLocks({ exclusive: Id64.toIdSet([element1Id, element2Id]) });
      const relationship = iModel.relationships.createInstance({
        classFullName: "BisCore:SubjectRefersToSubject",
        sourceId: element1Id,
        targetId: element2Id,
      });
      const relationshipId = iModel.relationships.insertInstance(relationship.toJSON());
      assert.isTrue(Id64.isValidId64(relationshipId));
      iModel.saveChanges();

      // Delete one element without deleting the relationship to corrupt the iModel
      const deleteResult = iModel[_nativeDb].executeSql(`DELETE FROM bis_Element WHERE Id=${element2Id}`);
      expect(deleteResult).to.equal(DbResult.BE_SQLITE_OK);
      iModel.saveChanges();

      // Run integrity check specifically for linktable foreign key Ids
      const results = await iModel.integrityCheck({
        quickCheck: true,
        specificChecks: {
          checkLinktableForeignKeyClassIds: true,
          checkLinktableForeignKeyIds: true,
        },
      });

      // Verify that the checkLinktableForeignKeyIds check reports the corruption
      expect(results).to.have.lengthOf(3);
      expect(results[0]).to.have.property("check").that.equals("Quick Check");
      expect(results[0]).to.have.property("passed").that.equals(false);
      expect(results[0]).to.have.property("results").that.is.an("array");
      expect(results[0].results.length).to.equal(9);
      assert(results[0].results.findIndex((row) => (row as QuickIntegrityCheckResultRow).passed === false) !== -1, "Quickcheck should report failed specific check");
      expect(results[1]).to.have.property("passed").that.equals(true);
      expect(results[1]).to.have.property("results").that.is.an("array").that.is.empty;
      expect(results[2]).to.have.property("passed").that.equals(false);
      expect(results[2].results).to.have.lengthOf(1);
      expect(results[2].results[0]).to.deep.include({
        sno: 1,
        id: "0x20000000001",
        relationship: "BisCore:ElementRefersToElements",
        property: "TargetECInstanceId",
        keyId: "0x20000000002",
        primaryClass: "BisCore:Element",
      });
    });

});