/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { DbResult, OpenMode } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { _nativeDb, ChannelControl, IModelDb, SnapshotDb, StandaloneDb } from "../../core-backend";
import { IModelJsFs } from "../../IModelJsFs";
import { SpatialCategory } from "../../Category";
import { withEditTxn } from "../../EditTxn";
import { IModelTestUtils } from "../IModelTestUtils";

describe("In-memory iModels", () => {
  // Deterministic, synchronous element count on the primary connection - always sees the latest committed data.
  const countElements = (db: IModelDb): number => {
    return db.withSqliteStatement("SELECT count(*) FROM bis_Element", (stmt) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      return stmt.getValueInteger(0);
    });
  };

  const insertCategory = (db: StandaloneDb, name: string): void => {
    withEditTxn(db, (txn) => SpatialCategory.insert(txn, IModelDb.dictionaryId, name, {}));
  };

  // Read spatial category code values via the ECSql reader, which runs on secondary (shared-cache) connections.
  const readCategoryNames = async (db: IModelDb): Promise<string[]> => {
    const names: string[] = [];
    for await (const row of db.createQueryReader(
      "SELECT CodeValue FROM bis.SpatialCategory WHERE CodeValue IS NOT NULL ORDER BY CodeValue",
      undefined,
      { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes },
    )) {
      names.push(row[0]);
    }
    return names;
  };

  it("creates an in-memory iModel that supports concurrent query", async () => {
    // An empty file name (or ":memory:") requests an in-memory iModel that is never written to disk.
    const memDb = StandaloneDb.createEmpty("", {
      rootSubject: { name: "in-memory" },
      enableTransactions: true,
    });
    try {
      assert.isTrue(memDb.isOpen);
      assert.isFalse(memDb.isReadonly);

      insertCategory(memDb, "in-memory category");

      // Concurrent query runs on secondary connections. For an in-memory iModel these must reach the same
      // shared-cache in-memory data - otherwise the query would run against an empty/missing database.
      let count = 0;
      for await (const row of memDb.createQueryReader("SELECT count(*) FROM bis.Element"))
        count = Number(row[0]);
      assert.isAbove(count, 0, "concurrent query on in-memory iModel should see the schema-created elements");
    } finally {
      memDb.close();
    }
  });

  it("supports ':memory:' as an in-memory file name", () => {
    const memDb = StandaloneDb.createEmpty(":memory:", {
      rootSubject: { name: "explicit-memory" },
      enableTransactions: true,
    });
    try {
      assert.isTrue(memDb.isOpen);
      assert.isAbove(countElements(memDb), 0);
    } finally {
      memDb.close();
    }
  });

  it("opens an on-disk iModel as a writable in-memory copy without modifying the source", () => {
    // Create an on-disk seed iModel with a bit of data.
    const seedName = IModelTestUtils.prepareOutputFile("InMemoryIModel", "inMemoryCopySeed.bim");
    const seed = StandaloneDb.createEmpty(seedName, {
      rootSubject: { name: "in-memory copy seed" },
      enableTransactions: true,
    });
    insertCategory(seed, "seed category");
    seed.close();

    // The authoritative on-disk element count that the in-memory copy will be made from.
    const baseline = ((): number => {
      const db = StandaloneDb.openFile(seedName, OpenMode.Readonly);
      try {
        return countElements(db);
      } finally {
        db.close();
      }
    })();
    assert.isAbove(baseline, 0);

    // Open a writable in-memory copy of the on-disk file. Changes are not written back to the source file.
    const memDb = StandaloneDb.openFile(seedName, OpenMode.ReadWrite, { openAsInMemoryCopy: true });
    try {
      assert.isTrue(memDb.isOpen);
      assert.isFalse(memDb.isReadonly, "in-memory copy should be writable");
      memDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      // The copy must contain the schema/data from the seed file.
      assert.equal(countElements(memDb), baseline, "in-memory copy should contain the seed schema/data");

      // Modify the in-memory copy - this must not touch the source file on disk.
      insertCategory(memDb, "in-memory only category");
      assert.isAbove(countElements(memDb), baseline, "inserting into the in-memory copy should add elements");
    } finally {
      memDb.close();
    }

    // The source file on disk must be unchanged by the in-memory edits.
    const reopenedSeed = StandaloneDb.openFile(seedName, OpenMode.Readonly);
    try {
      assert.equal(countElements(reopenedSeed), baseline, "changes to the in-memory copy must not be written back to the source file");
    } finally {
      reopenedSeed.close();
    }
  });

  it("ECSql reader reads in-memory data through the shared-cache secondary connections", async () => {
    const memDb = StandaloneDb.createEmpty("", {
      rootSubject: { name: "shared-cache" },
      enableTransactions: true,
    });
    try {
      // Insert data on the primary connection. The ECSql reader executes on separate, secondary connections,
      // so it can only see this data if those connections attach to the same shared-cache in-memory database.
      insertCategory(memDb, "alpha");
      insertCategory(memDb, "beta");
      insertCategory(memDb, "gamma");

      const names = await readCategoryNames(memDb);
      assert.deepEqual(names, ["alpha", "beta", "gamma"], "ECSql reader should read the categories inserted in the in-memory iModel");

      // Newly inserted rows must also become visible to subsequent reader queries.
      insertCategory(memDb, "delta");
      const namesAfter = await readCategoryNames(memDb);
      assert.deepEqual(namesAfter, ["alpha", "beta", "delta", "gamma"], "ECSql reader should observe rows added after the first query");
    } finally {
      memDb.close();
    }
  });

  it("writes an in-memory iModel out to a file on disk", async () => {
    const memDb = StandaloneDb.createEmpty("", {
      rootSubject: { name: "write-to-disk" },
      enableTransactions: true,
    });
    insertCategory(memDb, "persisted category");
    const expectedNames = await readCategoryNames(memDb);
    const expectedCount = countElements(memDb);

    const outName = IModelTestUtils.prepareOutputFile("InMemoryIModel", "inMemoryWriteOut.bim");
    if (IModelJsFs.existsSync(outName))
      IModelJsFs.removeSync(outName);

    // Flush the in-memory changes, then write the in-memory database out to a new file via vacuum-into.
    memDb.performCheckpoint();
    memDb[_nativeDb].vacuum({ into: outName });
    memDb.close();

    assert.isTrue(IModelJsFs.existsSync(outName), "vacuum-into should have produced a file on disk");

    // The written-out file must be a valid iModel containing the data from the in-memory database.
    const onDisk = SnapshotDb.openFile(outName);
    try {
      assert.equal(countElements(onDisk), expectedCount, "written-out file should contain the same elements as the in-memory iModel");
      assert.deepEqual(await readCategoryNames(onDisk), expectedNames, "written-out file should contain the categories from the in-memory iModel");
    } finally {
      onDisk.close();
    }
  });
});
