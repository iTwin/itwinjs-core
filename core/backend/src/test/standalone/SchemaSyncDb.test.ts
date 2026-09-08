/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, Id64, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, ElementReservationError } from "@itwin/core-common";
import { expect } from "chai";
import { IModelJsFs, SchemaSync } from "../../core-backend";
import { _nativeDb } from "../../internal/Symbols";
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

  function simulateVersion4Db() {
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
      "SELECT federationGuid, elementId, ecClassId, codeValue FROM reserved_elements ORDER BY elementId",
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
  const readNextLocalId = () => schemaDb["getNextReservedElementLocalId"]();

  describe("schema", () => {
    it("creates the reserved_elements table with elementId NOT NULL UNIQUE", () => {
      const cols = getTableInfo("reserved_elements");
      const names = cols.map((c) => c.name).sort();
      expect(names).to.deep.equal(["codeScope", "codeSpecId", "codeValue", "ecClassId", "elementId", "federationGuid"]);
      const elementIdCol = cols.find((c) => c.name === "elementId")!;
      expect(elementIdCol.notnull).to.equal(1);
    });

    it("refuses a database from the previous major version", () => {
      simulateVersion4Db();
      schemaDb.closeDb();

      expect(() => schemaDb.openDb(schemaDbFileName, OpenMode.ReadWrite)).to.throw();
    });
  });

  describe("reserveElements", () => {
    function makeReservation(federationGuid: string, codeValue: string, ecClassId = "0x1"): SchemaSync.ProposedElementReservation {
      return {
        federationGuid,
        ecClassId,
        code: Code.fromJSON({ spec: "0x1", scope: "0x2", value: codeValue }),
      };
    }

    it("throws when nextReservedElementLocalId file property is corrupt", async () => {
      for (const corruptValue of ["abc", "0", "-1", "1.5"]) {
        schemaDb[_nativeDb].saveFileProperty({ namespace: "schemasync", name: "nextReservedElementLocalId" }, corruptValue);
        schemaDb.saveChanges();

        await expectReservationError(schemaDb.reserveElements([
          makeReservation(Guid.createValue(), "cat"),
        ]), "corrupt-reservation-data");
      }
    });

    it("rejects duplicate non-empty code values across different federation guids", async () => {
      await expect(schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-X"),
        makeReservation(Guid.createValue(), "Cat-X"),
      ])).to.be.rejected;
    });

    it("treats code values case-insensitively when enforcing uniqueness", async () => {
      await expect(schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-A"),
        makeReservation(Guid.createValue(), "cat-a"),
      ])).to.be.rejected;
    });

    it("persists local-id counter across reserve calls", async () => {
      await schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-A"),
      ]);
      expect(readNextLocalId()).to.equal(2);

      await schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-B"),
      ]);
      expect(readNextLocalId()).to.equal(3);
    });

    it("allocates the elementId using the SchemaSyncElementReserved briefcase id", async () => {
      await schemaDb.reserveElements([makeReservation(Guid.createValue(), "Cat-A")]);
      const elementId = readReservedRows()[0].elementId;
      expect(elementId).to.equal(Id64.fromLocalAndBriefcaseIds(1, BriefcaseIdValue.SchemaSyncElementReserved));
      expect(Id64.getBriefcaseId(elementId)).to.equal(BriefcaseIdValue.SchemaSyncElementReserved);
      expect(Id64.getLocalId(elementId)).to.equal(1);
    });

    it("assigns sequential local Ids for a batch", async () => {
      await schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-A"),
        makeReservation(Guid.createValue(), "Cat-B"),
        makeReservation(Guid.createValue(), "Cat-C"),
      ]);
      const rows = readReservedRows();
      expect(rows).to.have.lengthOf(3);
      expect(rows.map((r) => Id64.getLocalId(r.elementId))).to.deep.equal([1, 2, 3]);
      expect(readNextLocalId()).to.equal(4);
    });

    it("is idempotent within a single call (duplicate element props)", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveElements([
        makeReservation(federationGuid, "Cat-A"),
        makeReservation(federationGuid, "Cat-A"),
      ]);
      expect(readReservedRows()).to.have.lengthOf(1);
      expect(readNextLocalId()).to.equal(2);
    });

    it("is idempotent across calls (returns existing id, allocates no new row)", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveElements([makeReservation(federationGuid, "Cat-A")]);
      const firstId = readReservedRows()[0].elementId;

      await schemaDb.reserveElements([makeReservation(federationGuid, "Cat-A")]);
      expect(readReservedRows()).to.have.lengthOf(1);
      expect(readReservedRows()[0].elementId).to.equal(firstId);
      expect(readNextLocalId()).to.equal(2);
    });

    it("allows multiple identities with empty codes to coexist", async () => {
      await schemaDb.reserveElements([
        makeReservation(Guid.createValue(), ""),
        makeReservation(Guid.createValue(), ""),
        makeReservation(Guid.createValue(), ""),
      ]);
      const rows = readReservedRows();
      expect(rows).to.have.lengthOf(3);
      expect(new Set(rows.map((r) => r.elementId)).size).to.equal(3);
    });

    it("throws when an existing reservation has a different class", async () => {
      const federationGuid = Guid.createValue();
      await schemaDb.reserveElements([makeReservation(federationGuid, "Cat-A", "0x1")]);
      await expectReservationError(schemaDb.reserveElements([
        makeReservation(federationGuid, "Cat-A", "0x2"),
      ]), "reservation-conflict");
    });

    it("throws when federationGuid and code resolve to different existing rows", async () => {
      const federationGuidA = Guid.createValue();
      const federationGuidB = Guid.createValue();
      await schemaDb.reserveElements([
        makeReservation(federationGuidA, "Cat-A"),
        makeReservation(federationGuidB, "Cat-B"),
      ]);
      // fedGuid lookup returns the A row, code lookup returns the B row.
      await expectReservationError(schemaDb.reserveElements([
        makeReservation(federationGuidA, "Cat-B"),
      ]), "reservation-conflict");
    });

    it("throws when the local-id sequence is exhausted", async () => {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      schemaDb["setNextReservedElementLocalId"](Math.pow(2, 40) - 2); // Seed counter near the 2^40 ceiling.
      schemaDb.saveChanges();
      await expectReservationError(schemaDb.reserveElements([
        makeReservation(Guid.createValue(), "Cat-A"),
        makeReservation(Guid.createValue(), "Cat-B"),
        makeReservation(Guid.createValue(), "Cat-C"),
      ]), "id-sequence-exhausted");
      expect(readReservedRows()).to.be.empty;
    });

    it("throws when a federationGuid is missing", async () => {
      await expectReservationError(schemaDb.reserveElements([
        { ecClassId: "0x1", code: Code.fromJSON({ spec: "0x1", scope: "0x2", value: "Cat-A" }) } as any,
      ]), "invalid-reservation");
      expect(readReservedRows()).to.be.empty;
    });
  });
});
