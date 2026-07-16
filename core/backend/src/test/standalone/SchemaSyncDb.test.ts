/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Guid, Id64, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, DefinitionError } from "@itwin/core-common";
import { expect } from "chai";
import { IModelJsFs, SchemaSync } from "../../core-backend";
import { _nativeDb } from "../../internal/Symbols";
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

describe("SchemaSyncDb", () => {
  let schemaDb: SchemaSync.SchemaSyncDb;
  let schemaDbFileName: string;

  beforeEach(() => {
    schemaDbFileName = IModelTestUtils.prepareOutputFile("SchemaSyncDb", "schema-sync.db");
    SchemaSync.SchemaSyncDb.createNewDb(schemaDbFileName);
    schemaDb = new SchemaSync.SchemaSyncDb();
    schemaDb.openDb(schemaDbFileName, OpenMode.ReadWrite);
  });

  afterEach(() => {
    if (schemaDb.isOpen)
      schemaDb.closeDb();
    IModelJsFs.removeSync(schemaDbFileName);
  });

  // This is a little gross, but the easiest way to test upgrading from v4.0
  function simulatePreviousDbSchema() {
    let res = schemaDb.executeSQL("DROP TABLE definition_elements");
    expect(res).to.equal(DbResult.BE_SQLITE_DONE);
    res = schemaDb.executeSQL("DROP TABLE IF EXISTS schema_reservation_ranges");
    expect(res).to.equal(DbResult.BE_SQLITE_DONE);
    res = schemaDb.executeSQL("DROP TABLE IF EXISTS schema_reservations");
    expect(res).to.equal(DbResult.BE_SQLITE_DONE);
    res = schemaDb.executeSQL("DELETE FROM be_Prop WHERE namespace='schemasync'");
    expect(res).to.equal(DbResult.BE_SQLITE_DONE);
    schemaDb.setRequiredVersions({ readVersion: "^4.0.0", writeVersion: "^4.0.0" });
    schemaDb.saveChanges();
  }

  function getTableInfo(tableName: string) {
    return schemaDb.withSqliteStatement(`PRAGMA table_info(${tableName})`, (stmt) => {
      const rows: Array<{ name: string, type: string, notnull: number }> = [];
      while (stmt.nextRow())
        rows.push({ name: stmt.getValueString(1), type: stmt.getValueString(2), notnull: stmt.getValueInteger(3) });
      return rows;
    });
  }

  function readReservedRows(): Array<{ federationGuid: string, elementId: string, ecClassId: string, codeValue: string }> {
    return schemaDb.withSqliteStatement(
      "SELECT federationGuid, elementId, ecClassId, codeValue FROM definition_elements ORDER BY elementId",
      (stmt) => {
        const rows: Array<{ federationGuid: string, elementId: string, ecClassId: string, codeValue: string }> = [];
        while (stmt.nextRow()) {
          rows.push({
            federationGuid: stmt.getValueGuid(0),
            elementId: stmt.getValueId(1),
            ecClassId: stmt.getValueId(2),
            codeValue: stmt.getValueString(3),
          });
        }
        return rows;
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/dot-notation
  const readNextDefinitionLocalId = () => schemaDb["getNextDefinitionLocalId"]();

  describe("schema", () => {
    it("creates the definition_elements table with elementId NOT NULL UNIQUE", () => {
      const cols = getTableInfo("definition_elements");
      const names = cols.map((c) => c.name).sort();
      expect(names).to.deep.equal(["codeScope", "codeSpecId", "codeValue", "ecClassId", "elementId", "federationGuid"]);
      const elementIdCol = cols.find((c) => c.name === "elementId")!;
      expect(elementIdCol.notnull).to.equal(1);
    });

    it("creates the schema_reservations and schema_reservation_ranges tables", () => {
      const reservationCols = getTableInfo("schema_reservations").map((c) => c.name).sort();
      expect(reservationCols).to.deep.equal(["baseFingerprint", "schemaName", "versionMajor", "versionMinor", "versionPatch"]);

      const rangeCols = getTableInfo("schema_reservation_ranges").map((c) => c.name).sort();
      expect(rangeCols).to.deep.equal(["count", "schemaName", "startId", "tableName", "versionMajor", "versionMinor", "versionPatch"]);
    });

    it("lazily updates to new schema just before reserving definition elements", async () => {
      simulatePreviousDbSchema();
      schemaDb.closeDb();
      schemaDb.openDb(schemaDbFileName, OpenMode.ReadWrite);

      expect(getTableInfo("definition_elements")).to.be.empty;
      expect(readNextDefinitionLocalId()).to.equal(1);
      let version = schemaDb.getRequiredVersions();
      expect(version.readVersion).to.equal("^4.0.0");
      expect(version.writeVersion).to.equal("^4.0.0");

      await schemaDb.reserveDefinitionElements([{
        federationGuid: Guid.createValue(),
        ecClassId: "0x1",
        code: Code.fromJSON({ spec: "0x1", scope: "0x2", value: "foo" })
      }]);

      expect(getTableInfo("definition_elements")).to.not.be.empty;
      expect(readNextDefinitionLocalId()).to.equal(2);
      version = schemaDb.getRequiredVersions();
      expect(version.readVersion).to.equal("^4.2.0");
      expect(version.writeVersion).to.equal("^4.2.0");
    });
  });

  describe("reserveDefinitionElements", () => {
    function makeDefinition(federationGuid: string | undefined, codeValue: string, ecClassId = "0x1"): SchemaSync.ProposedDefinition {
      return {
        federationGuid,
        ecClassId,
        code: Code.fromJSON({ spec: "0x1", scope: "0x2", value: codeValue }),
      };
    }

    it("throws when nextDefinitionLocalId file property is corrupt", async () => {
      for (const corruptValue of ["abc", "0", "-1", "1.5"]) {
        schemaDb[_nativeDb].saveFileProperty({ namespace: "schemasync", name: "nextDefinitionLocalId" }, corruptValue);
        schemaDb.saveChanges();

        await expectDefinitionError(schemaDb.reserveDefinitionElements([
          makeDefinition(Guid.createValue(), "cat"),
        ]), "corrupt-reservation-data");
      }
    });

    it("rejects duplicate non-empty code values across different federation guids", async () => {
      await expect(schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-X"),
        makeDefinition(Guid.createValue(), "Cat-X"),
      ])).to.be.rejected;
    });

    it("treats code values case-insensitively when enforcing uniqueness", async () => {
      await expect(schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-A"),
        makeDefinition(Guid.createValue(), "cat-a"),
      ])).to.be.rejected;
    });

    it("persists local-id counter across reserve calls", async () => {
      await schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-A"),
      ]);
      expect(readNextDefinitionLocalId()).to.equal(2);

      await schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-B"),
      ]);
      expect(readNextDefinitionLocalId()).to.equal(3);
    });

    it("allocates the elementId using the SchemaSyncDefinitionReserved briefcase id", async () => {
      await schemaDb.reserveDefinitionElements([makeDefinition(Guid.createValue(), "Cat-A")]);
      const elementId = readReservedRows()[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncDefinitionReserved));
      expect(Id64.getBriefcaseId(elementId)).to.equal(BriefcaseIdValue.SchemaSyncDefinitionReserved);
      expect(Id64.getLocalId(elementId)).to.equal(1);
    });

    it("assigns sequential local Ids for a batch", async () => {
      await schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-A"),
        makeDefinition(Guid.createValue(), "Cat-B"),
        makeDefinition(Guid.createValue(), "Cat-C"),
      ]);
      const rows = readReservedRows();
      expect(rows).to.have.lengthOf(3);
      expect(rows.map((r) => Id64.getLocalId(r.elementId))).to.deep.equal([1, 2, 3]);
      expect(readNextDefinitionLocalId()).to.equal(4);
    });

    it("is idempotent within a single call (duplicate element props)", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveDefinitionElements([
        makeDefinition(federationGuid, "Cat-A"),
        makeDefinition(federationGuid, "Cat-A"),
      ]);
      expect(readReservedRows()).to.have.lengthOf(1);
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("is idempotent across calls (returns existing id, allocates no new row)", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveDefinitionElements([makeDefinition(federationGuid, "Cat-A")]);
      const firstId = readReservedRows()[0].elementId;

      await schemaDb.reserveDefinitionElements([makeDefinition(federationGuid, "Cat-A")]);
      expect(readReservedRows()).to.have.lengthOf(1);
      expect(readReservedRows()[0].elementId).to.equal(firstId);
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("allows multiple identities with empty codes to coexist", async () => {
      await schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), ""),
        makeDefinition(Guid.createValue(), ""),
        makeDefinition(Guid.createValue(), ""),
      ]);
      const rows = readReservedRows();
      expect(rows).to.have.lengthOf(3);
      expect(new Set(rows.map((r) => r.elementId)).size).to.equal(3);
    });

    it("throws when an existing reservation has a different class", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveDefinitionElements([makeDefinition(federationGuid, "Cat-A", "0x1")]);
      await expectDefinitionError(schemaDb.reserveDefinitionElements([
        makeDefinition(federationGuid, "Cat-A", "0x2"),
      ]), "reservation-conflict");
    });

    it("throws when federationGuid and code resolve to different existing rows", async () => {
      const federationGuidA = Guid.createValue();
      const federationGuidB = Guid.createValue();
      await schemaDb.reserveDefinitionElements([
        makeDefinition(federationGuidA, "Cat-A"),
        makeDefinition(federationGuidB, "Cat-B"),
      ]);
      // fedGuid lookup returns the A row, code lookup returns the B row.
      await expectDefinitionError(schemaDb.reserveDefinitionElements([
        makeDefinition(federationGuidA, "Cat-B"),
      ]), "reservation-conflict");
    });

    it("throws when the local-id sequence is exhausted", async () => {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      schemaDb["setNextDefinitionLocalId"](Math.pow(2, 40) - 2); // Seed counter near the 2^40 ceiling.
      schemaDb.saveChanges();
      await expectDefinitionError(schemaDb.reserveDefinitionElements([
        makeDefinition(Guid.createValue(), "Cat-A"),
        makeDefinition(Guid.createValue(), "Cat-B"),
        makeDefinition(Guid.createValue(), "Cat-C"),
      ]), "id-sequence-exhausted");
      expect(readReservedRows()).to.be.empty;
    });
  });

  describe("reserveDefinitionElements (no federationGuid)", () => {
    function makeNoGuidDefinition(codeValue: string, ecClassId = "0x1"): SchemaSync.ProposedDefinition {
      return {
        ecClassId,
        code: Code.fromJSON({ spec: "0x1", scope: "0x2", value: codeValue }),
      };
    }

    it("generates a federationGuid when none is provided", async () => {
      await schemaDb.reserveDefinitionElements([makeNoGuidDefinition("Cat-A")]);
      const rows = readReservedRows();
      expect(rows).to.have.lengthOf(1);
      // A guid was auto-generated and stored.
      expect(Guid.isGuid(rows[0].federationGuid)).to.be.true;
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("reuses existing reservation by code when no federationGuid is provided (idempotent)", async () => {
      await schemaDb.reserveDefinitionElements([makeNoGuidDefinition("Cat-A")]);
      const firstRows = readReservedRows();
      const firstGuid = firstRows[0].federationGuid;
      const firstId = firstRows[0].elementId;

      // Second call with same code but still no fedGuid — should reuse the same row.
      await schemaDb.reserveDefinitionElements([makeNoGuidDefinition("Cat-A")]);
      const secondRows = readReservedRows();
      expect(secondRows).to.have.lengthOf(1);
      expect(secondRows[0].federationGuid).to.equal(firstGuid);
      expect(secondRows[0].elementId).to.equal(firstId);
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("deduplicates within a batch when two no-fedGuid entries share a code", async () => {
      await schemaDb.reserveDefinitionElements([
        makeNoGuidDefinition("Cat-A"),
        makeNoGuidDefinition("Cat-A"),
      ]);
      expect(readReservedRows()).to.have.lengthOf(1);
      expect(readNextDefinitionLocalId()).to.equal(2);
    });

    it("throws conflict when a code-resolved existing reservation has a different class", async () => {
      await schemaDb.reserveDefinitionElements([{ ...makeNoGuidDefinition("Cat-A"), ecClassId: "0x1" }]);

      await expectDefinitionError(schemaDb.reserveDefinitionElements([
        { ...makeNoGuidDefinition("Cat-A"), ecClassId: "0x2" },
      ]), "reservation-conflict");
    });

    it("throws when neither federationGuid nor a non-empty code value is provided", async () => {
      await expectDefinitionError(schemaDb.reserveDefinitionElements([
        makeNoGuidDefinition(""),
      ]), "invalid-definition");
      expect(readReservedRows()).to.be.empty;
    });
  });
});
