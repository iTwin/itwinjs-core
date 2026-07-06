/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import { OpenMode } from "@itwin/core-bentley";
import { AppModelChangesetType, AppModelDb } from "../../AppModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("AppModelDb", () => {

  const countRows = (db: AppModelDb, table: string): number =>
    db.withSqliteStatement(`SELECT COUNT(*) FROM ${table}`, (stmt) => {
      stmt.step();
      return stmt.getValue(0).getInteger();
    });

  // Create an empty AppModelDb (its profile creates the built-in "Dgns" table) and close it.
  const createSeedDb = (fileName: string): void => {
    const db = new AppModelDb();
    db.createDb(fileName);
    db.saveChanges();
    db.closeDb();
  };

  it("should create and apply AppModel changesets", () => {
    const seedName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-seed.db");
    const sourceName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-source.db");
    const targetName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-target.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel.changeset");

    // Two copies of the same seed share a db guid, so a changeset from one can be merged into the other.
    createSeedDb(seedName);
    fs.copyFileSync(seedName, sourceName);
    fs.copyFileSync(seedName, targetName);

    // Record a couple of changes on the source and serialize them into an AppModel changeset.
    const source = new AppModelDb();
    source.openDb(sourceName, OpenMode.ReadWrite);
    expect(source.hasPendingTxns).false;
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn2',0)`);
    source.saveChanges("add dgns");
    expect(source.hasPendingTxns).true;

    const cs = source.beginCreateChangeset(changesetFile);
    source.endCreateChangeset();
    expect(fs.existsSync(changesetFile)).true;
    expect(cs.id.length).equal(40, "changeset id is a 40-char SHA1 hex string");
    expect(cs.parentId).equal("", "the first changeset has no parent");
    expect(cs.dbGuid.length).greaterThan(0);
    expect(cs.changesetType).equal(AppModelChangesetType.Regular, "data-only changeset");
    source.closeDb();

    // Merge the changeset into the target and verify the change arrived and the parent advanced.
    const target = new AppModelDb();
    target.openDb(targetName, OpenMode.ReadWrite);
    expect(countRows(target, "Dgns")).equal(0);
    target.applyChangeset(cs);
    expect(countRows(target, "Dgns")).equal(2);
    expect(target.getParentChangesetId()).equal(cs.id, "parent id advances to the merged changeset");

    // Re-applying now fails: the changeset's parent ("") no longer matches the target's current changeset.
    expect(() => target.applyChangeset(cs)).throws();
    expect(countRows(target, "Dgns")).equal(2);
    target.closeDb();
  });

  it("should mark a changeset that carries schema changes as Schema", () => {
    const dbName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-schema.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-schema.changeset");
    const db = new AppModelDb();
    db.createDb(dbName);
    db.executeSQL("CREATE TABLE app_Custom(id INTEGER PRIMARY KEY,val TEXT)");
    db.executeSQL(`INSERT INTO app_Custom(val) VALUES ('x')`);
    db.saveChanges();

    const cs = db.beginCreateChangeset(changesetFile);
    db.endCreateChangeset();
    expect(cs.changesetType).equal(AppModelChangesetType.Schema);
    db.closeDb();
  });

  it("should throw when beginCreateChangeset is called without recorded changes", () => {
    const dbName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-empty.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-empty.changeset");
    createSeedDb(dbName);
    const db = new AppModelDb();
    db.openDb(dbName, OpenMode.ReadWrite);
    expect(db.hasPendingTxns).false;
    expect(() => db.beginCreateChangeset(changesetFile)).throws();
    expect(fs.existsSync(changesetFile)).false;
    db.closeDb();
  });

  it("should reject a changeset from a different db (guid mismatch)", () => {
    const sourceName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-guid-src.db");
    const otherName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-guid-other.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-guid.changeset");

    const source = new AppModelDb();
    source.createDb(sourceName);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    source.saveChanges();
    const cs = source.beginCreateChangeset(changesetFile);
    source.endCreateChangeset();
    source.closeDb();

    // An independently-created db has a different guid, so the merge must be rejected.
    const other = new AppModelDb();
    other.createDb(otherName);
    other.saveChanges();
    expect(() => other.applyChangeset(cs)).throws();
    expect(countRows(other, "Dgns")).equal(0);
    other.closeDb();
  });

  it("should reject a changeset whose id does not match its contents", () => {
    const seedName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-tamper-seed.db");
    const sourceName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-tamper-src.db");
    const targetName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-tamper-tgt.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-tamper.changeset");

    createSeedDb(seedName);
    fs.copyFileSync(seedName, sourceName);
    fs.copyFileSync(seedName, targetName);

    const source = new AppModelDb();
    source.openDb(sourceName, OpenMode.ReadWrite);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    source.saveChanges();
    const cs = source.beginCreateChangeset(changesetFile);
    source.endCreateChangeset();
    source.closeDb();

    const tampered = { ...cs, id: "0000000000000000000000000000000000000000" };
    const target = new AppModelDb();
    target.openDb(targetName, OpenMode.ReadWrite);
    expect(() => target.applyChangeset(tampered)).throws();
    expect(countRows(target, "Dgns")).equal(0, "a changeset with a bad id must not be applied");
    target.closeDb();
  });

  it("should reject a corrupted AppModel changeset file", () => {
    const seedName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-corrupt-seed.db");
    const sourceName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-corrupt-src.db");
    const targetName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-corrupt-tgt.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-corrupt.changeset");

    createSeedDb(seedName);
    fs.copyFileSync(seedName, sourceName);
    fs.copyFileSync(seedName, targetName);

    const source = new AppModelDb();
    source.openDb(sourceName, OpenMode.ReadWrite);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    source.saveChanges();
    const cs = source.beginCreateChangeset(changesetFile);
    source.endCreateChangeset();
    source.closeDb();

    // Corrupt the changeset file on disk while keeping its recorded props: validation must fail.
    fs.writeFileSync(cs.fileName, "this is not a valid changeset file");
    const target = new AppModelDb();
    target.openDb(targetName, OpenMode.ReadWrite);
    expect(() => target.applyChangeset(cs)).throws();
    expect(countRows(target, "Dgns")).equal(0);
    target.closeDb();
  });

  it("should store staged txn props on the next committed txn and then clear them", () => {
    const dbName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-txnprops.db");
    const db = new AppModelDb();
    db.createDb(dbName);
    db.saveChanges();

    // The staged props are stored in the appmodel_txns.Props column of the txn produced by the next saveChanges.
    const readLastProps = (): string | undefined =>
      db.withSqliteStatement(`SELECT Props FROM appmodel_txns ORDER BY Id DESC LIMIT 1`, (stmt) => {
        stmt.step();
        const val = stmt.getValue(0);
        return val.isNull ? undefined : val.getString();
      });

    const props = JSON.stringify({ author: "tester", note: "first change" });
    db.setTxnProps(props);
    db.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    db.saveChanges("with props");
    expect(readLastProps()).equal(props, "staged props are stored on the committed txn");

    // Props are cleared after the txn is written, so the next txn carries none.
    db.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn2',0)`);
    db.saveChanges("no props");
    expect(readLastProps()).to.be.undefined;
    db.closeDb();
  });

  it("should clear captured txns on endCreateChangeset and chain the next changeset", () => {
    const dbName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-chain.db");
    const cs1File = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-chain1.changeset");
    const cs2File = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-chain2.changeset");

    const db = new AppModelDb();
    db.createDb(dbName);
    db.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn1',0)`);
    db.saveChanges();
    expect(db.hasPendingTxns).true;

    // begin writes the file but keeps the captured txns and does not advance the changeset id.
    const cs1 = db.beginCreateChangeset(cs1File);
    expect(cs1.parentId).equal("", "the first changeset has no parent");
    expect(db.hasPendingTxns).true;
    expect(db.getParentChangesetId()).equal("", "begin must not advance the changeset id");

    // end deletes the captured txns and advances the changeset id.
    db.endCreateChangeset();
    expect(db.hasPendingTxns).false;
    expect(db.getParentChangesetId()).equal(cs1.id, "end advances the changeset id");

    // A second changeset created afterward chains onto the first.
    db.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('dgn2',0)`);
    db.saveChanges();
    const cs2 = db.beginCreateChangeset(cs2File);
    expect(cs2.parentId).equal(cs1.id, "the second changeset chains onto the first");
    expect(cs2.id).not.equal(cs1.id);
    expect(cs2.id.length).equal(40);
    db.endCreateChangeset();

    // end with no create in progress throws.
    expect(() => db.endCreateChangeset()).throws();
    db.closeDb();
  });

  it("should roll back the entire changeset when applying it hits a data conflict", () => {
    const seedName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-conflict-seed.db");
    const sourceName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-conflict-src.db");
    const targetName = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-conflict-tgt.db");
    const changesetFile = IModelTestUtils.prepareOutputFile("AppModelDb", "appmodel-conflict.changeset");

    createSeedDb(seedName);
    fs.copyFileSync(seedName, sourceName);
    fs.copyFileSync(seedName, targetName);

    // Source inserts two rows (getting ID 1 and 2) and serializes them into a changeset.
    const source = new AppModelDb();
    source.openDb(sourceName, OpenMode.ReadWrite);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('src-dgn1',0)`);
    source.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('src-dgn2',0)`);
    source.saveChanges();
    const cs = source.beginCreateChangeset(changesetFile);
    source.endCreateChangeset();
    source.closeDb();

    // Target independently inserts a row that takes ID=1, which the changeset's first insert collides with.
    const target = new AppModelDb();
    target.openDb(targetName, OpenMode.ReadWrite);
    target.executeSQL(`INSERT INTO Dgns(Name,IsDgnLib) VALUES ('tgt-dgn',0)`);
    target.saveChanges();
    expect(countRows(target, "Dgns")).equal(1);

    // Validation passes (matching guid, parent, and id), but the apply conflicts on the primary key.
    // The whole changeset must be aborted and rolled back, leaving the target exactly as it was.
    expect(() => target.applyChangeset(cs)).throws();
    expect(countRows(target, "Dgns")).equal(1, "a conflicting changeset is fully rolled back");
    expect(target.getParentChangesetId()).equal("", "parent id is not advanced on a failed apply");
    const name = target.withSqliteStatement(`SELECT Name FROM Dgns WHERE ID=1`, (stmt) => {
      stmt.step();
      return stmt.getValue(0).getString();
    });
    expect(name).equal("tgt-dgn", "the pre-existing row is intact after rollback");
    target.closeDb();
  });

});
