/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, IModel } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite, IModelJsFs, SchemaSync, StandaloneDb } from "../../core-backend";
import { DrawingCategory } from "../../Category";
import { _nativeDb, _onDefinitionElementInsert } from "../../internal/Symbols";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { IModelTestUtils } from "../IModelTestUtils";

const fedGuidA = "8b33a6ec-1a6f-4ae2-8ad4-c426276d1f30";
const fedGuidB = "1f0e5b96-1234-4abc-9def-0123456789ab";

describe.only("SchemaSync definition-element reservation", () => {
  let iModel: StandaloneDb;
  let iModelFileName: string;
  let schemaDb: SchemaSync.SchemaSyncDb;
  let schemaDbFileName: string;

  beforeEach(() => {
    iModelFileName = IModelTestUtils.prepareOutputFile("SchemaSyncDefinitionReservation", "definition-reservation.bim");
    schemaDbFileName = IModelTestUtils.prepareOutputFile("SchemaSyncDefinitionReservation", "definition-reservation-sync.db");
    iModel = StandaloneDb.createEmpty(iModelFileName, { rootSubject: { name: "SchemaSyncDefinitionReservation" } });
    SchemaSync.SchemaSyncDb.createNewDb(schemaDbFileName);
    schemaDb = new SchemaSync.SchemaSyncDb();
    schemaDb.openDb(schemaDbFileName, OpenMode.ReadWrite);
  });

  afterEach(() => {
    sinon.restore();
    if (schemaDb.isOpen)
      schemaDb.closeDb();
    if (iModel.isOpen)
      iModel.close();

    IModelJsFs.removeSync(iModelFileName);
    IModelJsFs.removeSync(schemaDbFileName);
  });

  // `SchemaSyncReservations` only ever obtains its access object via `SchemaSync.getCloudAccess`, so we
  // stub that single seam to hand back a mock that delegates every operation to the already-open
  // `schemaDb`. `withLockedDb` / `writeLocker` mirror the real commit-on-success, abandon-on-error
  // semantics without any CloudContainer.
  function stubCloudAccess() {
    // This is the minimal `SchemaSync.CloudAccess` surface that `SchemaSyncReservations` actually consumes.
    const access = {
      synchronizeWithCloud() { },
      close() { },
      getUri: () => `${schemaDbFileName}?vfs=test`,
      container: { hasLocalChanges: false } as CloudSqlite.CloudContainer, // these tests use local-only SchemaSyncDb, no need to mock a real CloudContainer
      reader: {
        findReservedDefinition: (federationGuid) => schemaDb.findReservedDefinition(federationGuid),
      },
      writeLocker: {
        reserveDefinitionElements: async (ids) => {
          try {
            await schemaDb.reserveDefinitionElements(ids);
            schemaDb.saveChanges();
          } catch (err) {
            schemaDb.abandonChanges();
            throw err;
          }
        },
      },
      withLockedDb: async (_args, operation) => {
        try {
          const result = await operation();
          schemaDb.saveChanges();
          return result;
        } catch (err) {
          schemaDb.abandonChanges();
          throw err;
        }
      },
    } satisfies Partial<SchemaSync.CloudAccess>;
    sinon.stub(SchemaSync, "getCloudAccess").resolves(access as SchemaSync.CloudAccess);
    return access;
  }

  function enableSchemaSync(): void {
    sinon.stub(iModel[_nativeDb], "schemaSyncEnabled").returns(true);
  }

  async function setupSchemaSyncReservations() {
    const access = stubCloudAccess();
    enableSchemaSync();
    await iModel.initializeReservationControl();
    return access;
  }

  function readAllRows(): Array<{ federationGuid: string, elementId: string, ecClassId: string, codeSpecId: string, codeScope: string, codeValue: string }> {
    return schemaDb.withSqliteStatement(
      "SELECT federationGuid, elementId, ecClassId, codeSpecId, codeScope, codeValue FROM definition_elements ORDER BY elementId",
      (stmt) => {
        const rows: Array<{ federationGuid: string, elementId: string, ecClassId: string, codeSpecId: string, codeScope: string, codeValue: string }> = [];
        while (stmt.nextRow()) {
          rows.push({
            federationGuid: stmt.getValueGuid(0),
            elementId: stmt.getValueId(1),
            ecClassId: stmt.getValueId(2),
            codeSpecId: stmt.getValueId(3),
            codeScope: stmt.getValueId(4),
            codeValue: stmt.getValueString(5),
          });
        }
        return rows;
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/dot-notation
  const readNextDefinitionLocalId = () => schemaDb["getNextDefinitionLocalId"]();
  const nonEmptyCode = (value: string) => ({ spec: "0x01", scope: "0x02", value })

  describe("reservation control initialization", () => {
    it("uses NoReservations when SchemaSync is disabled", async () => {
      await iModel.initializeReservationControl();
      expect(iModel.reservations.needsDefinitionReservation(fedGuidA)).to.be.false;
      await expect(iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      })).to.be.fulfilled;
    });

    it("initializes SchemaSync-backed reservations after initializeForIModel", async () => {
      let schemaSyncEnabled = false;
      stubCloudAccess();
      sinon.stub(iModel[_nativeDb], "schemaSyncEnabled").callsFake(() => schemaSyncEnabled);
      sinon.stub(iModel[_nativeDb], "schemaSyncInit").callsFake(() => {
        schemaSyncEnabled = true;
      });
      sinon.stub(iModel, "acquireSchemaLock").resolves();
      sinon.stub(iModel, "pullChanges").resolves();
      sinon.stub(iModel, "pushChanges").resolves();

      await iModel.initializeReservationControl();
      expect(iModel.reservations.needsDefinitionReservation(fedGuidA)).to.be.false;

      const previousEnforcement = EditTxn.implicitWriteEnforcement;
      EditTxn.implicitWriteEnforcement = "allow";
      try {
        await SchemaSync.initializeForIModel({
          iModel,
          containerProps: {
            baseUri: "https://example.invalid",
            containerId: "definition-reservation",
            storageType: "azure",
          },
        });
      } finally {
        EditTxn.implicitWriteEnforcement = previousEnforcement;
      }

      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(readAllRows()).to.have.lengthOf(1);
      expect(readAllRows()[0].federationGuid).to.equal(fedGuidA);
    });

    it("reports needsDefinitionReservation only for valid unreserved guids when SchemaSync is enabled", async () => {
      await setupSchemaSyncReservations();

      expect(iModel.reservations.needsDefinitionReservation(fedGuidA)).to.be.true;
      expect(iModel.reservations.needsDefinitionReservation("not-a-guid")).to.be.false;

      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      expect(iModel.reservations.needsDefinitionReservation(fedGuidA)).to.be.false;
      expect(iModel.reservations.needsDefinitionReservation(fedGuidB)).to.be.true;
    });
  });

  describe("reserveDefinitionElements", () => {
    it("reserves a single ID and advances the counter", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-A") }],
      });

      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      const elementId = rows[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncDefinitionReserved));

      expect(rows[0].federationGuid).to.equal(fedGuidA);
      expect(rows[0].elementId).to.equal(elementId);
      expect(rows[0].codeValue).to.equal("TD-A");
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("reserves two IDs for categories and advances the counter", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      const elementId = rows[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncDefinitionReserved));

      expect(rows[0].federationGuid).to.equal(fedGuidA);
      expect(rows[0].elementId).to.equal(elementId);
      expect(rows[0].codeValue).to.equal("Cat-A");
      expect(readNextDefinitionLocalId()).to.equal(3); // +2 because category inserts always trigger a second insert for default subcategory
    });

    it("throws and rolls back on duplicate non-empty code in input", async () => {
      await setupSchemaSyncReservations();
      await expect(iModel.reservations.reserveDefinitionElements({
        elements: [
          { federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") },
          { federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") },
        ],
      })).to.be.rejected;
    });

    it("aggregates validation errors and reserves nothing on failure", async () => {
      await setupSchemaSyncReservations();
      await expect(iModel.reservations.reserveDefinitionElements({
        elements: [
          { federationGuid: "not-a-guid", classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidA, classFullName: "BisCore:NonexistentClassXYZ", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: { spec: "not-an-id", scope: IModel.dictionaryId, value: "Cat" } },
        ],
      })).to.be.rejected;
      expect(readAllRows()).to.be.empty;
      expect(readNextDefinitionLocalId()).to.equal(1);
    });

    it("rolls back counter and rows when the locked-db write is abandoned", async () => {
      const syncAccess = await setupSchemaSyncReservations();
      // First reserve advances the counter to 2 and commits.
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-A") }],
      });
      expect(readNextDefinitionLocalId()).to.equal(2);

      // Simulate something going wrong with the upload where the db write is abandoned instead of committed.
      syncAccess.writeLocker.reserveDefinitionElements = async (ids) => {
        try {
          await schemaDb.reserveDefinitionElements(ids);
        } finally {
          schemaDb.abandonChanges();
        }
      };

      // The second reserve allocates + inserts a new row, then the write is abandoned.
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidB, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-B") }],
      });

      // The new row should not be visible, and the counter file-property must remain at "2".
      const rows = readAllRows();
      expect(rows.map((r) => r.federationGuid)).to.deep.equal([fedGuidA]);
      expect(readNextDefinitionLocalId()).to.equal(2);
    });
  });

  describe("ReservationControl _onDefinitionElementInsert hook", () => {
    it("is a no-op when SchemaSync is not enabled", () => {
      // schemaSyncEnabled returns false by default.
      const arg = {
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      };
      expect(() => iModel.reservations[_onDefinitionElementInsert](arg)).not.to.throw();
      expect((arg.props as any).id).to.be.undefined;
      expect((arg.options as any).forceUseId).to.be.undefined;
    });

    it("is a no-op when the schema lock is held", async () => {
      await setupSchemaSyncReservations();
      sinon.stub(iModel, "holdsSchemaLock").get(() => true);

      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: { classFullName: "BisCore:DrawingCategory" },
        options: {},
      } as any)).not.to.throw();
    });

    it("throws 'No SchemaSync reservation found' when reserve has never been called", async () => {
      await setupSchemaSyncReservations();
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw(/No SchemaSync reservation found/);
    });

    it("throws 'No SchemaSync reservation found' for an unreserved federationGuid", async () => {
      await setupSchemaSyncReservations();
      // Reserve some other identity so the read handle is initialized.
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidB,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-B"),
        },
        options: {},
      })).to.throw(/No SchemaSync reservation found/);
    });

    it("throws when federationGuid is missing or malformed", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: undefined,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw(/valid federationGuid/);
    });

    it("throws when SchemaSync container has local changes", async () => {
      const syncAccess = await setupSchemaSyncReservations();
      (syncAccess.container as any).hasLocalChanges = true;

      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw(/local changes in the SchemaSync container/);
    });

    it("sets props.id and options.forceUseId when the reservation matches", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      const expectedId = readAllRows()[0].elementId;

      const props: any = {
        classFullName: "BisCore:DrawingCategory",
        federationGuid: fedGuidA,
        model: IModel.dictionaryId,
        code: nonEmptyCode("Cat-A"),
      };
      const options: any = {};
      iModel.reservations[_onDefinitionElementInsert]({ iModel, props, options });
      expect(props.id).to.equal(expectedId);
      expect(options.forceUseId).to.be.true;
    });

    it("throws when the insert's class does not match the reserved class", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:SpatialCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw(/reserved as a different class/);
    });

    it("throws when the insert's code does not match the reserved code", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-DIFFERENT"),
        },
        options: {},
      })).to.throw(/different Code/);
    });

    it("applies reserved element id during a real DrawingCategory insert", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "ReservedEndToEndCategory";
      const categoryCode = DrawingCategory.createCode(iModel, IModel.dictionaryId, categoryName);
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: categoryCode }],
      });

      const expectedId = readAllRows()[0].elementId;
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      category.federationGuid = fedGuidA;
      const insertedId = withEditTxn(iModel, (txn) => category.insert(txn));
      expect(insertedId).to.equal(expectedId);
      expect(Id64.getBriefcaseId(insertedId)).to.equal(BriefcaseIdValue.SchemaSyncDefinitionReserved);
    });
  });

});
