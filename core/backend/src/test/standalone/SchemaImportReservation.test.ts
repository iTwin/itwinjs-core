/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { OpenMode } from "@itwin/core-bentley";
import { SchemaImportReservationError } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite, IModelJsFs, SchemaSync, StandaloneDb } from "../../core-backend";
import { _nativeDb, _onSchemaImport } from "../../internal/Symbols";
import { SchemaImportIdentity } from "../../SharedSchemaReservations";
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

const idA: SchemaImportIdentity = { schemaName: "TestSchema", versionMajor: 1, versionMinor: 0, versionPatch: 0 };
const idB: SchemaImportIdentity = { schemaName: "OtherSchema", versionMajor: 2, versionMinor: 3, versionPatch: 4 };

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

  /** Set up a minimal CloudAccess stub that delegates reads/writes to the already-open schemaDb. */
  function stubCloudAccess() {
    const access = {
      synchronizeWithCloud() { },
      close() { },
      getUri: () => `${schemaDbFileName}?vfs=test`,
      container: { hasLocalChanges: false } as CloudSqlite.CloudContainer,
      reader: {
        findReservedDefinition: (key: any) => schemaDb.findReservedDefinition(key),
        findSchemaReservation: (identity: SchemaImportIdentity) => schemaDb.findSchemaReservation(identity),
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
        reserveSchemaImport: async (identity: SchemaImportIdentity, perTableCounts: Record<string, number>, baseFingerprint: string) => {
          try {
            await schemaDb.reserveSchemaImport(identity, perTableCounts, baseFingerprint);
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

  // ---- SchemaSyncDb-level tests ----

  describe("SchemaSyncDb.reserveSchemaImport", () => {
    it("persists a reservation header and range rows", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 3, ec_Property: 5 }, "fp1");
      schemaDb.saveChanges();

      const reservation = schemaDb.findSchemaReservation(idA);
      expect(reservation).to.not.be.undefined;
      expect(reservation!.baseFingerprint).to.equal("fp1");
      expect(reservation!.ranges.size).to.equal(2);
      expect(reservation!.ranges.get("ec_Class")).to.deep.equal({ startId: 1, count: 3 });
      expect(reservation!.ranges.get("ec_Property")).to.deep.equal({ startId: 1, count: 5 });
    });

    it("advances the shared per-table counter for each reservation", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 3 }, "fp1");
      schemaDb.saveChanges();
      await schemaDb.reserveSchemaImport(idB, { ec_Class: 2 }, "fp2");
      schemaDb.saveChanges();

      const resA = schemaDb.findSchemaReservation(idA)!;
      const resB = schemaDb.findSchemaReservation(idB)!;

      // B's startId should be A's startId + A's count
      expect(resA.ranges.get("ec_Class")).to.deep.equal({ startId: 1, count: 3 });
      expect(resB.ranges.get("ec_Class")).to.deep.equal({ startId: 4, count: 2 });
    });

    it("is idempotent when the same identity and counts are reserved twice", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 3 }, "fp1");
      schemaDb.saveChanges();

      // Second call with the same identity and same counts — must be a no-op.
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 3 }, "fp1");
      schemaDb.saveChanges();

      const reservation = schemaDb.findSchemaReservation(idA)!;
      expect(reservation.ranges.size).to.equal(1);
      expect(reservation.ranges.get("ec_Class")).to.deep.equal({ startId: 1, count: 3 });
    });

    it("throws reservation-conflict when the same identity is reserved with different counts", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 3 }, "fp1");
      schemaDb.saveChanges();

      await expectSchemaImportReservationError(
        schemaDb.reserveSchemaImport(idA, { ec_Class: 5 }, "fp1"),
        "reservation-conflict",
      );
    });

    it("skips tables with a count of zero", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 2, ec_Property: 0 }, "fp");
      schemaDb.saveChanges();

      const reservation = schemaDb.findSchemaReservation(idA)!;
      expect(reservation.ranges.has("ec_Property")).to.be.false;
      expect(reservation.ranges.get("ec_Class")).to.deep.equal({ startId: 1, count: 2 });
    });

    it("returns undefined from findSchemaReservation for unknown identities", () => {
      expect(schemaDb.findSchemaReservation(idA)).to.be.undefined;
    });

    it("stores and retrieves independent reservations for different schemas", async () => {
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 1 }, "fpA");
      schemaDb.saveChanges();
      await schemaDb.reserveSchemaImport(idB, { ec_Class: 2 }, "fpB");
      schemaDb.saveChanges();

      expect(schemaDb.findSchemaReservation(idA)!.baseFingerprint).to.equal("fpA");
      expect(schemaDb.findSchemaReservation(idB)!.baseFingerprint).to.equal("fpB");
    });
  });

  // ---- SharedSchemaReservations control tests ----

  describe("SharedSchemaReservations control", () => {
    it("uses NoSchemaReservations when SchemaSync is disabled", async () => {
      await iModel.initializeSharedSchemaReservations();
      expect(iModel.schemaReservations.isServerBased).to.be.false;
      expect(iModel.schemaReservations.needsSchemaReservation(idA)).to.be.false;
      await expect(iModel.schemaReservations.reserveSchemaImport(idA)).to.be.fulfilled;
    });

    it("uses server-based reservations when SchemaSync is enabled", async () => {
      await setupSchemaSyncSchemaReservations();
      expect(iModel.schemaReservations.isServerBased).to.be.true;
    });

    it("validates identity on needsSchemaReservation — throws invalid-identity for empty schemaName", async () => {
      await setupSchemaSyncSchemaReservations();
      expect(() => iModel.schemaReservations.needsSchemaReservation({ schemaName: "", versionMajor: 1, versionMinor: 0, versionPatch: 0 }))
        .to.throw().that.satisfies((err: unknown) => SchemaImportReservationError.isError(err, "invalid-identity"));
    });

    it("validates identity on needsSchemaReservation — throws invalid-identity for negative version", async () => {
      await setupSchemaSyncSchemaReservations();
      expect(() => iModel.schemaReservations.needsSchemaReservation({ schemaName: "Foo", versionMajor: -1, versionMinor: 0, versionPatch: 0 }))
        .to.throw().that.satisfies((err: unknown) => SchemaImportReservationError.isError(err, "invalid-identity"));
    });

    it("needsSchemaReservation returns true before reservation, false after", async () => {
      await setupSchemaSyncSchemaReservations();

      expect(iModel.schemaReservations.needsSchemaReservation(idA)).to.be.true;

      await iModel.schemaReservations.reserveSchemaImport(idA);

      expect(iModel.schemaReservations.needsSchemaReservation(idA)).to.be.false;
    });

    it("is idempotent: reserving the same schema twice succeeds without error", async () => {
      await setupSchemaSyncSchemaReservations();

      await expect(iModel.schemaReservations.reserveSchemaImport(idA)).to.be.fulfilled;
      await expect(iModel.schemaReservations.reserveSchemaImport(idA)).to.be.fulfilled;
    });
  });

  // ---- _onSchemaImport hook tests ----

  describe("_onSchemaImport hook", () => {
    it("is a no-op when SchemaSync is disabled", async () => {
      await iModel.initializeSharedSchemaReservations();
      const nativeOptions: Record<string, unknown> = {};
      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions })).to.not.throw();
      expect(nativeOptions.forceReservedIds).to.be.undefined;
    });

    it("is a no-op when the schema lock is held", async () => {
      const access = await setupSchemaSyncSchemaReservations();
      await iModel.schemaReservations.reserveSchemaImport(idA);

      sinon.stub(iModel, "holdsSchemaLock").get(() => true);
      const nativeOptions: Record<string, unknown> = {};
      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions })).to.not.throw();
      expect(nativeOptions.forceReservedIds).to.be.undefined;

      // avoid unused-variable warning
      void access;
    });

    it("throws container-has-local-changes when the container has local changes", async () => {
      const access = await setupSchemaSyncSchemaReservations();
      await iModel.schemaReservations.reserveSchemaImport(idA);

      (access.container as any).hasLocalChanges = true;
      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions: {} }))
        .to.throw().that.satisfies((err: unknown) => SchemaImportReservationError.isError(err, "container-has-local-changes"));
    });

    it("throws reservation-not-found when no reservation exists", async () => {
      await setupSchemaSyncSchemaReservations();
      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions: {} }))
        .to.throw().that.satisfies((err: unknown) => SchemaImportReservationError.isError(err, "reservation-not-found"));
    });

    it("populates nativeOptions with reserved ranges when reservation is found", async () => {
      await setupSchemaSyncSchemaReservations();

      // Directly inject a reservation into schemaDb to simulate a previously reserved schema.
      await schemaDb.reserveSchemaImport(idA, { ec_Class: 2, ec_Property: 3 }, "fp1");
      schemaDb.saveChanges();

      const nativeOptions: Record<string, unknown> = {};
      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions })).to.not.throw();

      expect(nativeOptions.forceReservedIds).to.be.true;
      const res = nativeOptions.schemaImportReservation as any;
      expect(res).to.not.be.undefined;
      expect(res.reservedRanges.ec_Class).to.deep.equal({ startId: 1, count: 2 });
      expect(res.reservedRanges.ec_Property).to.deep.equal({ startId: 1, count: 3 });
    });

    it("throws base-state-mismatch when fingerprints differ", async () => {
      await setupSchemaSyncSchemaReservations();

      await schemaDb.reserveSchemaImport(idA, { ec_Class: 1 }, "fingerprint-at-reserve-time");
      schemaDb.saveChanges();

      // Make native return a different fingerprint (simulating intervening schema changes).
      sinon.stub(iModel[_nativeDb] as any, "getSchemaImportBaseFingerprint").returns("different-fingerprint");

      expect(() => iModel.schemaReservations[_onSchemaImport]({ identity: idA, nativeOptions: {} }))
        .to.throw().that.satisfies((err: unknown) => SchemaImportReservationError.isError(err, "base-state-mismatch"));
    });
  });
});
