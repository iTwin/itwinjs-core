/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SchemaImportReservationError } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite, IModelJsFs, SchemaSync, StandaloneDb } from "../../core-backend";
import { _nativeDb } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";

/** Assert that `promise` rejects with a `SchemaImportReservationError` carrying the given key. */
async function expectSchemaImportReservationError(promise: Promise<unknown>, key: SchemaImportReservationError.Key): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect(SchemaImportReservationError.isError(err, key), `expected SchemaImportReservationError '${key}', got: ${JSON.stringify(err)}`).to.be.true;
    return;
  }
  expect.fail(`expected promise to reject with SchemaImportReservationError '${key}'`);
}

describe("Schema import reservation", () => {
  let iModel: StandaloneDb;
  let iModelFileName: string;
  let schemaDb: SchemaSync.SchemaSyncDb;
  let schemaDbFileName: string;

  beforeEach(() => {
    iModelFileName = IModelTestUtils.prepareOutputFile("SchemaImportReservation", "schema-import-reservation.bim");
    schemaDbFileName = IModelTestUtils.prepareOutputFile("SchemaImportReservation", "schema-import-reservation-sync.db");
    iModel = StandaloneDb.createEmpty(iModelFileName, { rootSubject: { name: "SchemaImportReservation" } });
    SchemaSync.SchemaSyncDb.createNewDb(schemaDbFileName);
    schemaDb = new SchemaSync.SchemaSyncDb();
    schemaDb.openDb(schemaDbFileName, { openMode: "ReadWrite" });
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

  /** Set up a minimal CloudAccess stub that delegates withLockedDb to the already-open schemaDb. */
  function stubCloudAccess() {
    const access = {
      synchronizeWithCloud() { },
      close() { },
      getUri: () => `${schemaDbFileName}?vfs=test`,
      container: { hasLocalChanges: false } as CloudSqlite.CloudContainer,
      reader: {
        findReservedDefinition: (key: any) => schemaDb.findReservedDefinition(key),
      },
      writeLocker: {
        reserveDefinitionElements: async (ids: any) => {
          try {
            await schemaDb.reserveDefinitionElements(ids);
            schemaDb.saveChanges();
          } catch (err) {
            schemaDb.abandonChanges();
            throw err;
          }
        },
      },
      withLockedDb: async (_args: any, operation: () => Promise<any>) => {
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

  async function setupSchemaSyncSchemaReservations() {
    const access = stubCloudAccess();
    enableSchemaSync();
    await iModel.initializeSharedSchemaReservations();
    return access;
  }

  // ---- SharedSchemaReservations control tests ----

  describe("SharedSchemaReservations control", () => {
    it("uses NoSchemaReservations (no-op) when SchemaSync is disabled", async () => {
      await iModel.initializeSharedSchemaReservations();
      expect(iModel.schemaReservations.isServerBased).to.be.false;
      // No-op: resolves without error regardless of input
      await expect(iModel.schemaReservations.reserveSchemaImport(["any/path.xml"])).to.be.fulfilled;
    });

    it("uses server-based reservations when SchemaSync is enabled", async () => {
      await setupSchemaSyncSchemaReservations();
      expect(iModel.schemaReservations.isServerBased).to.be.true;
    });
  });

  // ---- Argument validation ----

  describe("argument validation", () => {
    it("throws invalid-argument for an empty array", async () => {
      await setupSchemaSyncSchemaReservations();
      await expectSchemaImportReservationError(
        iModel.schemaReservations.reserveSchemaImport([]),
        "invalid-argument",
      );
    });

    it("throws invalid-argument when array contains a non-string element", async () => {
      await setupSchemaSyncSchemaReservations();
      await expectSchemaImportReservationError(
        iModel.schemaReservations.reserveSchemaImport([42 as unknown as string]),
        "invalid-argument",
      );
    });

    it("throws invalid-argument when array contains null", async () => {
      await setupSchemaSyncSchemaReservations();
      await expectSchemaImportReservationError(
        iModel.schemaReservations.reserveSchemaImport([null as unknown as string]),
        "invalid-argument",
      );
    });
  });

  // ---- Native call delegation ----

  describe("native delegation", () => {
    it("calls nativeDb.reserveSchemaImport with the correct arguments under the write-lock", async () => {
      const access = await setupSchemaSyncSchemaReservations();
      const reserveStub = sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport");
      const withLockedDbSpy = sinon.spy(access, "withLockedDb");

      const schemaFiles = ["schema/BisCore.01.00.00.xml"];
      await iModel.schemaReservations.reserveSchemaImport(schemaFiles);

      // The write-lock must have been acquired
      expect(withLockedDbSpy.calledOnce).to.be.true;
      // Native must have been called inside the lock with the right arguments
      expect(reserveStub.calledOnce).to.be.true;
      const [calledFiles, calledUri, calledSourceType] = reserveStub.firstCall.args;
      expect(calledFiles).to.deep.equal(schemaFiles);
      expect(calledUri).to.equal(access.getUri());
      expect(calledSourceType).to.be.undefined; // default sourceType
    });

    it("passes sourceType='xml' through to nativeDb.reserveSchemaImport", async () => {
      await setupSchemaSyncSchemaReservations();
      const reserveStub = sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport");

      const xmlStrings = ["<ECSchema schemaName='Foo' version='1.0.0' xmlns='ECv3' />"];
      await iModel.schemaReservations.reserveSchemaImport(xmlStrings, "xml");

      const [, , calledSourceType] = reserveStub.firstCall.args;
      expect(calledSourceType).to.equal("xml");
    });

    it("passes sourceType='file' through to nativeDb.reserveSchemaImport", async () => {
      await setupSchemaSyncSchemaReservations();
      const reserveStub = sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport");

      await iModel.schemaReservations.reserveSchemaImport(["schema/Foo.xml"], "file");

      const [, , calledSourceType] = reserveStub.firstCall.args;
      expect(calledSourceType).to.equal("file");
    });

    it("is idempotent: calling reserveSchemaImport twice succeeds when native does not throw", async () => {
      await setupSchemaSyncSchemaReservations();
      sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport"); // no-op stub

      const schemaFiles = ["schema/BisCore.01.00.00.xml"];
      await expect(iModel.schemaReservations.reserveSchemaImport(schemaFiles)).to.be.fulfilled;
      await expect(iModel.schemaReservations.reserveSchemaImport(schemaFiles)).to.be.fulfilled;
    });

    it("propagates errors thrown by native", async () => {
      await setupSchemaSyncSchemaReservations();
      sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport").throws(new Error("native-error"));

      await expect(iModel.schemaReservations.reserveSchemaImport(["schema/Foo.xml"])).to.be.rejectedWith("native-error");
    });

    it("TS never receives a key→id map — native owns the blob writes", async () => {
      await setupSchemaSyncSchemaReservations();
      // Verify that reserveSchemaImport returns void (undefined), not a map
      let returnValue: unknown = "sentinel";
      sinon.stub(iModel[_nativeDb] as any, "reserveSchemaImport").returns(undefined);
      returnValue = await iModel.schemaReservations.reserveSchemaImport(["schema/Foo.xml"]);
      expect(returnValue).to.be.undefined;
    });
  });

  // ---- Carve-out: SchemaSync disabled ----

  describe("carve-out: SchemaSync disabled", () => {
    it("no-op reserveSchemaImport does not call nativeDb.reserveSchemaImport when SchemaSync is disabled", async () => {
      // Do NOT enableSchemaSync() — SchemaSync is disabled
      await iModel.initializeSharedSchemaReservations();
      const nativeSpy = sinon.spy(iModel[_nativeDb] as any, "reserveSchemaImport");

      await iModel.schemaReservations.reserveSchemaImport(["schema/Foo.xml"]);

      expect(nativeSpy.notCalled).to.be.true;
    });
  });
});
