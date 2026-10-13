/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { DbResult } from "@itwin/core-bentley";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { Suite } from "mocha";
import { HubWrappers, KnownTestLocations } from "..";
import { BriefcaseDb } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";

chai.use(chaiAsPromised);

/**
 * Repro for Bug 2115705: "DbTable 'bis_ElementMultiAspect' has N non-virtual columns, but the physical table has M columns."
 *
 * No semantic rebase and no schema sync involved. A dynamic schema adds an ElementMultiAspect subclass wide enough to
 * ALTER TABLE ADD shared columns to bis_ElementMultiAspect. discardChanges() then reverses the EcSchema txn (ec_* rows)
 * but skips the Ddl txn (TxnManager::ApplyTxnChanges returns early for TxnType::Ddl), so the physical columns remain
 * with no ec_Column rows. The next regular schema import validates strictly and fails.
 */
describe("Dynamic schema discard leaves orphan physical columns (Bug 2115705)", function (this: Suite) {
  this.timeout(90000);
  const tableName = "bis_ElementMultiAspect";
  const extraColumns = 6;
  let briefcase: BriefcaseDb | undefined;

  before(() => HubMock.startup("DynamicSchemaOrphanColumns", KnownTestLocations.outputDir));
  after(() => HubMock.shutdown());
  afterEach(() => {
    briefcase?.close();
    briefcase = undefined;
  });

  const physicalColumns = (db: BriefcaseDb): string[] =>
    db.withSqliteStatement(`PRAGMA table_info([${tableName}])`, (stmt) => {
      const names: string[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        names.push(stmt.getValue(1).getString());
      return names;
    });

  const mappedNonVirtualColumnCount = (db: BriefcaseDb): number =>
    db.withSqliteStatement(
      `SELECT COUNT(*) FROM ec_Column c JOIN ec_Table t ON t.Id = c.TableId WHERE t.Name = '${tableName}' AND c.IsVirtual = 0`,
      (stmt) => {
        chai.expect(stmt.step()).to.equal(DbResult.BE_SQLITE_ROW);
        return stmt.getValue(0).getInteger();
      });

  const dynamicSchemaWithWideMultiAspect = (propCount: number) => `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="DynTest" alias="dyn" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
      <ECEntityClass typeName="WideMultiAspect">
        <BaseClass>bis:ElementMultiAspect</BaseClass>
        ${Array.from({ length: propCount }, (_, i) => `<ECProperty propertyName="P${i + 1}" typeName="string"/>`).join("\n        ")}
      </ECEntityClass>
    </ECSchema>`;

  const unrelatedSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="Unrelated" alias="unr" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="Thing">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="Name" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  const dynamicSchema = (version: string, propCount: number | undefined) => `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="DynTest" alias="dyn" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
      ${propCount === undefined ? "" : `<ECEntityClass typeName="WideMultiAspect">
        <BaseClass>bis:ElementMultiAspect</BaseClass>
        ${Array.from({ length: propCount }, (_, i) => `<ECProperty propertyName="P${i + 1}" typeName="string"/>`).join("\n        ")}
      </ECEntityClass>`}
    </ECSchema>`;

  it("deleting dynamic-schema properties/classes keeps ec_Column and physical columns in sync", async () => {
    const accessToken = "user1";
    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId: HubMock.iTwinId, iModelName: "DynDelete" });
    briefcase = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId: HubMock.iTwinId, iModelId });
    const db = briefcase;
    const assertInSync = (step: string) =>
      chai.expect(physicalColumns(db).length).to.equal(mappedNonVirtualColumnCount(db), `out of sync after ${step}`);

    const sharedColumnCount = physicalColumns(db).filter((name) => /^ps\d+$/i.test(name)).length;
    const wide = sharedColumnCount + extraColumns;

    await db.importSchemaStrings([dynamicSchema("01.00.00", wide)]);
    assertInSync("wide import");
    await db.importSchemaStrings([dynamicSchema("02.00.00", 1)]); // delete P2..Pn
    assertInSync("property deletion");
    await db.importSchemaStrings([dynamicSchema("03.00.00", undefined)]); // delete the class
    assertInSync("class deletion");
    await db.importSchemaStrings([unrelatedSchema]); // strict validation passes
    assertInSync("unrelated import");
  });

  it("dynamic-schema deletions pushed and pulled keep the pulling briefcase in sync", async () => {
    const iModelId = await HubMock.createNewIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelName: "DynDeletePull" });
    const writer = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    const reader = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    try {
      const assertInSync = (db: BriefcaseDb, step: string) =>
        chai.expect(physicalColumns(db).length).to.equal(mappedNonVirtualColumnCount(db), `${db === writer ? "writer" : "reader"} out of sync after ${step}`);

      const wide = physicalColumns(writer).filter((name) => /^ps\d+$/i.test(name)).length + extraColumns;
      const steps: Array<[string, string]> = [
        ["wide import", dynamicSchema("01.00.00", wide)],
        ["property deletion", dynamicSchema("02.00.00", 1)],
        ["class deletion", dynamicSchema("03.00.00", undefined)],
      ];
      for (const [step, xml] of steps) {
        await writer.importSchemaStrings([xml]);
        await writer.pushChanges({ description: step });
        assertInSync(writer, step);
        await reader.pullChanges();
        assertInSync(reader, step);
      }

      // Strict validation on the pulling briefcase passes.
      await reader.importSchemaStrings([unrelatedSchema]);
      assertInSync(reader, "unrelated import");
    } finally {
      writer.close();
      reader.close();
    }
  });

  it("discardChanges after a dynamic schema import breaks the next schema import", async () => {
    const accessToken = "user1";
    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId: HubMock.iTwinId, iModelName: "DynOrphan" });
    briefcase = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId: HubMock.iTwinId, iModelId });

    const baselineColumns = physicalColumns(briefcase);
    chai.expect(baselineColumns.length).to.equal(mappedNonVirtualColumnCount(briefcase), "baseline must be consistent");

    // Dynamic schema whose aspect needs more shared columns than the table has -> ALTER TABLE ADD COLUMN.
    const sharedColumnCount = baselineColumns.filter((name) => /^ps\d+$/i.test(name)).length;
    await briefcase.importSchemaStrings([dynamicSchemaWithWideMultiAspect(sharedColumnCount + extraColumns)]);
    chai.expect(physicalColumns(briefcase).length).to.equal(baselineColumns.length + extraColumns, "import should add physical columns");
    chai.expect(mappedNonVirtualColumnCount(briefcase)).to.equal(baselineColumns.length + extraColumns);

    // Abandon the un-pushed dynamic schema: ec_* is reverted, the DDL is not.
    await briefcase.discardChanges();
    const dynSchemaCount = briefcase.withSqliteStatement("SELECT COUNT(*) FROM ec_Schema WHERE Name = 'DynTest'", (stmt) => {
      stmt.step();
      return stmt.getValue(0).getInteger();
    });
    chai.expect(dynSchemaCount).to.equal(0, "dynamic schema should be gone after discardChanges");

    const mapped = mappedNonVirtualColumnCount(briefcase);
    const physical = physicalColumns(briefcase).length;
    chai.expect(mapped).to.equal(baselineColumns.length);
    chai.expect(physical - mapped).to.equal(extraColumns, `orphan columns left in ${tableName}`);

    // Any subsequent regular schema import (importSchemas / upgradeSchemas) validates strictly and fails.
    await chai.expect(briefcase.importSchemaStrings([unrelatedSchema])).to.be.rejectedWith(
      `DbTable '${tableName}' has ${mapped} non-virtual columns, but the physical table has ${physical} columns.`);
  });
});
