/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Guid, Id64, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, DefinitionError, IModel } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite, IModelJsFs, SchemaSync, StandaloneDb } from "../../core-backend";
import { DrawingCategory } from "../../Category";
import { _nativeDb, _onDefinitionElementInsert } from "../../internal/Symbols";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { IModelTestUtils } from "../IModelTestUtils";

/** Assert that `promise` rejects with a `DefinitionError` carrying the given key. */
async function expectDefinitionError(promise: Promise<unknown>, key: DefinitionError.Key): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect(DefinitionError.isError(err, key), `expected DefinitionError '${key}', got: ${JSON.stringify(err)}`).to.be.true;
    return;
  }
  expect.fail(`expected promise to reject with DefinitionError '${key}'`);
}

const fedGuidA = "8b33a6ec-1a6f-4ae2-8ad4-c426276d1f30";
const fedGuidB = "1f0e5b96-1234-4abc-9def-0123456789ab";

describe("SchemaSync definition-element reservation", () => {
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
        findReservedDefinition: (key) => schemaDb.findReservedDefinition(key),
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
    await iModel.initializeSharedDefinitionReservations();
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
  const nonEmptyCode = (value: string) => ({ spec: "0x1", scope: "0x2", value });
  const invalidCode = () => ({ spec: "", scope: "", value: "BAD" });

  describe("reservation control initialization", () => {
    it("uses NoReservations when SchemaSync is disabled", async () => {
      await iModel.initializeSharedDefinitionReservations();
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

      await iModel.initializeSharedDefinitionReservations();
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
      expect(() => iModel.reservations.needsDefinitionReservation("not-a-guid")).to.throw().that.satisfies(
        (err: unknown) => DefinitionError.isError(err, "invalid-definition")
      );

      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      expect(iModel.reservations.needsDefinitionReservation(fedGuidA)).to.be.false;
      expect(iModel.reservations.needsDefinitionReservation(fedGuidB)).to.be.true;
    });

    it("reports needsDefinitionReservation only for valid non-empty codes when SchemaSync is enabled", async () => {
      await setupSchemaSyncReservations();

      expect(iModel.reservations.needsDefinitionReservation(nonEmptyCode("Cat-A"))).to.be.true;
      expect(() => iModel.reservations.needsDefinitionReservation(invalidCode())).to.throw().that.satisfies(
        (err: unknown) => DefinitionError.isError(err, "invalid-definition")
      );
      expect(() => iModel.reservations.needsDefinitionReservation(Code.createEmpty())).to.throw().that.satisfies(
        (err: unknown) => DefinitionError.isError(err, "invalid-definition")
      );

      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      expect(iModel.reservations.needsDefinitionReservation(nonEmptyCode("Cat-A"))).to.be.false;
      expect(iModel.reservations.needsDefinitionReservation(nonEmptyCode("Cat-B"))).to.be.true;
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
      await expectDefinitionError(iModel.reservations.reserveDefinitionElements({
        elements: [
          { federationGuid: "not-a-guid", classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidA, classFullName: "BisCore:NonexistentClassXYZ", code: nonEmptyCode("Cat") },
          { federationGuid: fedGuidB, classFullName: "BisCore:DrawingCategory", code: { spec: "not-an-id", scope: IModel.dictionaryId, value: "Cat" } },
          // No federationGuid and empty code: ambiguous identity.
          { classFullName: "BisCore:DrawingCategory", code: { spec: "0x01", scope: "0x02", value: "" } },
        ],
      }), "invalid-definition");
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

  describe("reserveDefinitionElements (no federationGuid)", () => {
    it("reserves and allocates an id when no federationGuid is provided", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ classFullName: "BisCore:DrawingCategory", code: { spec: "0x01", scope: "0x02", value: "No-Guid-Cat" } }],
      });
      const rows = readAllRows();
      expect(rows).to.have.lengthOf(1);
      expect(Guid.isGuid(rows[0].federationGuid)).to.be.true;
    });

    it("is idempotent when called twice for the same code without a federationGuid", async () => {
      await setupSchemaSyncReservations();
      const code = { spec: "0x01", scope: "0x02", value: "Idempotent-Cat" };
      await iModel.reservations.reserveDefinitionElements({ elements: [{ classFullName: "BisCore:DrawingCategory", code }] });
      const firstRows = readAllRows();
      const firstGuid = firstRows[0].federationGuid;

      await iModel.reservations.reserveDefinitionElements({ elements: [{ classFullName: "BisCore:DrawingCategory", code }] });
      const secondRows = readAllRows();
      expect(secondRows).to.have.lengthOf(1);
      expect(secondRows[0].federationGuid).to.equal(firstGuid);
    });

    it("rejects entries with a present-but-invalid federationGuid string", async () => {
      await setupSchemaSyncReservations();
      await expectDefinitionError(iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: "not-a-guid", classFullName: "BisCore:DrawingCategory", code: { spec: "0x01", scope: "0x02", value: "Cat" } }],
      }), "invalid-definition");
    });
  });

  describe("SharedDefinitionReservations _onDefinitionElementInsert hook", () => {
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
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "reservation-not-found"));
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
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "reservation-not-found"));
    });

    it("throws when federationGuid is present but malformed", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: "not-a-valid-guid",
          model: IModel.dictionaryId,
          code: nonEmptyCode("Cat-A"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "invalid-definition"));
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
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "container-has-local-changes"));
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
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "reservation-conflict"));
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
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "reservation-conflict"));
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

    it("throws when neither federationGuid nor a non-empty code value is provided", async () => {
      await setupSchemaSyncReservations();
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: undefined,
          model: IModel.dictionaryId,
          code: { spec: "0x01", scope: "0x02", value: "" },
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "invalid-definition"));
    });

    it("resolves reservation by code and stamps federationGuid onto props when fedGuid is undefined", async () => {
      await setupSchemaSyncReservations();
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ federationGuid: fedGuidA, classFullName: "BisCore:DrawingCategory", code: nonEmptyCode("Cat-A") }],
      });

      const props: any = {
        classFullName: "BisCore:DrawingCategory",
        federationGuid: undefined,
        model: IModel.dictionaryId,
        code: nonEmptyCode("Cat-A"),
      };
      const options: any = {};
      iModel.reservations[_onDefinitionElementInsert]({ iModel, props, options });

      // The hook must have resolved the federationGuid from the existing reservation.
      expect(props.federationGuid).to.equal(fedGuidA);
      // And must have forced the reserved element id.
      expect(props.id).to.equal(readAllRows()[0].elementId);
      expect(options.forceUseId).to.be.true;
    });

    it("throws 'No SchemaSync reservation found' when no fedGuid and no code match", async () => {
      await setupSchemaSyncReservations();
      expect(() => iModel.reservations[_onDefinitionElementInsert]({
        iModel,
        props: {
          classFullName: "BisCore:DrawingCategory",
          federationGuid: undefined,
          model: IModel.dictionaryId,
          code: nonEmptyCode("Unknown-Cat"),
        },
        options: {},
      })).to.throw().that.satisfies((err: unknown) => DefinitionError.isError(err, "reservation-not-found"));
    });

    it("applies reserved element id during a real no-fedGuid DrawingCategory insert", async () => {
      await setupSchemaSyncReservations();
      const categoryName = "ReservedNoGuidCategory";
      const categoryCode = DrawingCategory.createCode(iModel, IModel.dictionaryId, categoryName);
      // Reserve by code only (no federationGuid).
      await iModel.reservations.reserveDefinitionElements({
        elements: [{ classFullName: "BisCore:DrawingCategory", code: categoryCode }],
      });

      const reservation = readAllRows()[0];
      const expectedId = reservation.elementId;
      const expectedFedGuid = reservation.federationGuid;

      // Insert without federationGuid — the hook resolves it.
      const category = DrawingCategory.create(iModel, IModel.dictionaryId, categoryName);
      const insertedId = withEditTxn(iModel, (txn) => category.insert(txn));
      expect(insertedId).to.equal(expectedId);
      expect(Id64.getBriefcaseId(insertedId)).to.equal(BriefcaseIdValue.SchemaSyncDefinitionReserved);

      const inserted = iModel.elements.getElement(insertedId);
      expect(inserted.federationGuid).to.equal(expectedFedGuid);
      expect(inserted.code.equals(categoryCode)).to.be.true;
    });
  });
});
