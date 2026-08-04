/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Id64, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, ElementReservationError, IModel } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite, IModelJsFs, SchemaSync, StandaloneDb } from "../../core-backend";
import { DrawingCategory } from "../../Category";
import { _nativeDb, _onReservedElementInsert } from "../../internal/Symbols";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { IModelTestUtils } from "../IModelTestUtils";

/** Assert that `promise` rejects with an `ElementReservationError` carrying the given key. */
async function expectReservationError(promise: Promise<unknown>, key: ElementReservationError.Key): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect(ElementReservationError.isError(err, key), `expected ElementReservationError '${key}', got: ${JSON.stringify(err)}`).to.be.true;
    return;
  }
  expect.fail(`expected promise to reject with ElementReservationError '${key}'`);
}

const fedGuidA = "8b33a6ec-1a6f-4ae2-8ad4-c426276d1f30";
const fedGuidB = "1f0e5b96-1234-4abc-9def-0123456789ab";

describe("SchemaSync element reservation", () => {
  let iModel: StandaloneDb;
  let iModelFileName: string;
  let schemaDb: SchemaSync.SchemaSyncDb;
  let schemaDbFileName: string;

  beforeEach(() => {
    iModelFileName = IModelTestUtils.prepareOutputFile("SchemaSyncElementReservation", "element-reservation.bim");
    schemaDbFileName = IModelTestUtils.prepareOutputFile("SchemaSyncElementReservation", "element-reservation-sync.db");
    iModel = StandaloneDb.createEmpty(iModelFileName, { rootSubject: { name: "SchemaSyncElementReservation" } });
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
        findReservedElement: (fedGuid) => schemaDb.findReservedElement(fedGuid),
      },
      writeLocker: {
        reserveElements: async (ids) => {
          try {
            await schemaDb.reserveElements(ids);
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
    await iModel.initializeSharedElementReservations();
    return access;
  }

  function readAllRows(): Array<{ federationGuid: string, elementId: string, ecClassId: string, codeSpecId: string, codeScope: string, codeValue: string }> {
    return schemaDb.withSqliteStatement(
      "SELECT federationGuid, elementId, ecClassId, codeSpecId, codeScope, codeValue FROM reserved_elements ORDER BY elementId",
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
  const readNextLocalId = () => schemaDb["getNextReservedElementLocalId"]();
  const nonEmptyCode = (value: string) => ({ spec: "0x1", scope: "0x2", value });

  describe("reservation control initialization", () => {
    it("uses NoReservations when SchemaSync is disabled", async () => {
      await iModel.initializeSharedElementReservations();
      expect(iModel.reservations.needsElementReservation(fedGuidA)).to.be.false;
      await expect(iModel.reservations.reserveElements({
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

      await iModel.initializeSharedElementReservations();
      expect(iModel.reservations.needsElementReservation(fedGuidA)).to.be.false;

      const previousEnforcement = EditTxn.implicitWriteEnforcement;
      EditTxn.implicitWriteEnforcement = "allow";
      try {
        await SchemaSync.initializeForIModel({
          iModel,
          containerProps: {
            baseUri: "https://example.invalid",
            containerId: "element-reservation",
            storageType: "azure",
          },
        });
      } finally {
        EditTxn.implicitWriteEnforcement = previousEnforcement;
      }

      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(readAllRows()).to.have.lengthOf(1);
      expect(readAllRows()[0].federationGuid).to.equal(fedGuidA);
    });

    it("reports needsElementReservation only for valid unreserved guids when SchemaSync is enabled", async () => {
      await setupSchemaSyncReservations();

      expect(iModel.reservations.needsElementReservation(fedGuidA)).to.be.true;
      expect(() => iModel.reservations.needsElementReservation("not-a-guid")).to.throw().that.satisfies(
        (err: unknown) => ElementReservationError.isError(err, "invalid-reservation")
      );

      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      expect(iModel.reservations.needsElementReservation(fedGuidA)).to.be.false;
      expect(iModel.reservations.needsElementReservation(fedGuidB)).to.be.true;
    });
  });

  describe("reserveElements", () => {
    it("reserves a single ID and advances the counter", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-A") }],
      });

      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      const elementId = rows[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncElementReserved));

      expect(rows[0].federationGuid).to.equal(fedGuidA);
      expect(rows[0].elementId).to.equal(elementId);
      expect(rows[0].codeValue).to.equal("TD-A");
      expect(readNextLocalId()).to.equal(2);
    });

    it("reserves a non-definition element with an explicit federationGuid", async () => {
      await setupSchemaSyncReservations();
      // A Subject is *not* a DefinitionElement; under the broadened rule it is still reservable.
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:Subject" }],
      });
      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].federationGuid).to.equal(fedGuidA);
      expect(rows[0].codeValue).to.equal(""); // empty code
    });

    it("reserves two IDs for categories and advances the counter", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      const elementId = rows[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncElementReserved));

      expect(rows[0].federationGuid).to.equal(fedGuidA);
      expect(rows[0].elementId).to.equal(elementId);
      expect(rows[0].codeValue).to.equal("Cat-A");
      expect(readNextLocalId()).to.equal(3); // +2 because category inserts always trigger a second insert for default subcategory
    });

    it("is idempotent when reserving the identical identity twice", async () => {
      await setupSchemaSyncReservations();
      const args = { elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }] };
      await iModel.reservations.reserveElements(args);
      await iModel.reservations.reserveElements(args);
      expect(readAllRows()).to.have.lengthOf(1);
    });

    it("throws reservation-conflict when the same non-empty code is reserved for different guids (in one batch)", async () => {
      await setupSchemaSyncReservations();
      await expect(iModel.reservations.reserveElements({
        elements: [
          { federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") },
          { federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") },
        ],
      })).to.be.rejected;
      expect(readAllRows()).to.be.empty;
    });

    it("throws reservation-conflict when the same non-empty code is reserved for a different guid (across batches)", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") }],
      });
      await expect(iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-X") }],
      })).to.be.rejected;
      expect(readAllRows()).to.have.lengthOf(1);
    });

    it("aggregates validation errors and reserves nothing on failure", async () => {
      await setupSchemaSyncReservations();
      await expectReservationError(iModel.reservations.reserveElements({
        elements: [
          { federationGuid: "not-a-guid", classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidA, classFullName: "BisCore:NonexistentClassXYZ", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: { spec: "not-an-id", scope: IModel.dictionaryId, value: "Cat" } },
        ],
      }), "invalid-reservation");
      expect(readAllRows()).to.be.empty;
      expect(readNextLocalId()).to.equal(1);
    });

    it("rejects entries with a missing federationGuid", async () => {
      await setupSchemaSyncReservations();
      await expectReservationError(iModel.reservations.reserveElements({
        elements: [{ classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat") } as any],
      }), "invalid-reservation");
      expect(readAllRows()).to.be.empty;
    });

    it("rolls back counter and rows when the locked-db write is abandoned", async () => {
      const syncAccess = await setupSchemaSyncReservations();
      // First reserve advances the counter to 2 and commits.
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-A") }],
      });
      expect(readNextLocalId()).to.equal(2);

      // Simulate something going wrong with the upload where the db write is abandoned instead of committed.
      syncAccess.writeLocker.reserveElements = async (ids) => {
        try {
          await schemaDb.reserveElements(ids);
        } finally {
          schemaDb.abandonChanges();
        }
      };

      // The second reserve allocates + inserts a new row, then the write is abandoned.
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidB, classFullName: "BisCore:TypeDefinitionElement", code: nonEmptyCode("TD-B") }],
      });

      // The new row should not be visible, and the counter file-property must remain at "2".
      const rows = readAllRows();
      expect(rows.map((r) => r.federationGuid)).to.deep.equal([fedGuidA]);
      expect(readNextLocalId()).to.equal(2);
    });
  });

  describe("Reservations _onReservedElementInsert hook", () => {
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
      expect(() => iModel.reservations[_onReservedElementInsert](arg)).not.to.throw();
      expect((arg.props as any).id).to.be.undefined;
      expect((arg.options as any).forceUseId).to.be.undefined;
    });

    it("is a no-op when the schema lock is held", async () => {
      await setupSchemaSyncReservations();
      sinon.stub(iModel, "holdsSchemaLock").get(() => true);

      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: { classFullName: "BisCore:DrawingCategory" },
        options: {},
      } as any)).not.to.throw();
    });

    it("throws 'reservation-not-found' when reserve has never been called", async () => {
      await setupSchemaSyncReservations();
      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "reservation-not-found"));
    });

    it("throws 'reservation-not-found' for an unreserved federationGuid", async () => {
      await setupSchemaSyncReservations();
      // Reserve some other identity so the read handle is initialized.
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidB,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-B"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "reservation-not-found"));
    });

    it("throws when federationGuid is present but malformed", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: "not-a-valid-guid",
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "invalid-reservation"));
    });

    it("throws when SchemaSync container has local changes", async () => {
      const syncAccess = await setupSchemaSyncReservations();
      (syncAccess.container as any).hasLocalChanges = true;

      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "container-has-local-changes"));
    });

    it("sets props.id and options.forceUseId when the reservation matches", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
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
      iModel.reservations[_onReservedElementInsert]({ iModel, props, options });
      expect(props.id).to.equal(expectedId);
      expect(options.forceUseId).to.be.true;
    });

    it("throws when the insert's class does not match the reserved class", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:SpatialCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "reservation-conflict"));
    });

    it("throws when the insert's code does not match the reserved code", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onReservedElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: fedGuidA,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-DIFFERENT"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "reservation-conflict"));
    });

    it("applies reserved element id during a real DrawingCategory insert", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "ReservedEndToEndCategory";
      const categoryCode = DrawingCategory.createCode(iModel, IModel.dictionaryId, categoryName);
      await iModel.reservations.reserveElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: categoryCode }],
      });

      const expectedId = readAllRows()[0].elementId;
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      category.federationGuid = fedGuidA;
      const insertedId = withEditTxn(iModel, (txn) => category.insert(txn));
      expect(insertedId).to.equal(expectedId);
      expect(Id64.getBriefcaseId(insertedId)).to.equal(BriefcaseIdValue.SchemaSyncElementReserved);
    });

    it("inserts freely (no reservation) when no federationGuid is set", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "UnreservedNoGuidCategory";
      // No federationGuid on the element => ordinary element => not gated => inserts normally.
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      const insertedId = withEditTxn(iModel, (txn) => category.insert(txn));
      expect(Id64.getBriefcaseId(insertedId)).to.not.equal(BriefcaseIdValue.SchemaSyncElementReserved);
    });

    it("bypasses the reservation check when skipReservationCheck is set", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "SkippedCategory";
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      category.federationGuid = fedGuidA; // explicit fedGuid but no reservation exists
      const props = category.toJSON();
      const insertedId = withEditTxn(iModel, (txn) => txn.insertElement(props, { skipReservationCheck: true }));
      expect(Id64.getBriefcaseId(insertedId)).to.not.equal(BriefcaseIdValue.SchemaSyncElementReserved);
      expect(iModel.elements.getElement(insertedId).federationGuid).to.equal(fedGuidA);
    });

    it("throws reservation-not-found for a real insert of an unreserved element with an explicit fedGuid", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "UnreservedGuidCategory";
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      category.federationGuid = fedGuidB; // explicit fedGuid, never reserved
      expect(() => withEditTxn(iModel, (txn) => category.insert(txn)))
        .to.throw().that.satisfies((err: unknown) => ElementReservationError.isError(err, "reservation-not-found"));
    });
  });
});
