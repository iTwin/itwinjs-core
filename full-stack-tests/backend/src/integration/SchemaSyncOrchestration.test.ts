/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, BriefcaseManager, CloudSqlite, IModelHost, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid, Logger, LogLevel } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

const storageType = "azure";

/**
 * Schema sync orchestration poc.
 *
 * The container holds a log of `importSchemas` calls - the schema xml, grouped and ordered - instead of a
 * copy of the `ec_` tables. A briefcase catches up by replaying the calls it has not seen through the real
 * importer. Everything rests on one claim: identical base state plus identical import calls in identical
 * order produce identical `ec_` rows.
 *
 * The oracle is the `ecdb_schema` / `ecdb_map` / `sqlite_schema` checksum triple. `ecdb_map` and
 * `sqlite_schema` are the ones that matter - they cover the physical layout, which is what silently
 * corrupts data when it diverges.
 */
describe("Schema sync orchestration", function (this: Suite) {
  this.timeout(0);

  const user1 = "token 1";
  const user2 = "token 2";
  const user3 = "token 3";

  // --- schema fixtures -------------------------------------------------------------------------

  const pipeSchema = (version: string, props: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestPipe" alias="tp" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="Pipe">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          ${props.map((p) => `<ECProperty propertyName="${p}" typeName="int" />`).join("\n          ")}
      </ECEntityClass>
  </ECSchema>`;

  const valveSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestValve" alias="tv" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="Valve">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="v1" typeName="int" />
      </ECEntityClass>
  </ECSchema>`;

  /** Grows a BisCore element subclass until its properties spill out of the shared columns into an overflow table. */
  const sharedColumnSchema = (version: string, propCount: number) => `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestShared" alias="tsh" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="Wide">
          <BaseClass>bis:DefinitionElement</BaseClass>
          ${Array.from({ length: propCount }, (_v, i) => `<ECProperty propertyName="p${i}" typeName="string" />`).join("\n          ")}
      </ECEntityClass>
  </ECSchema>`;

  /** Custom unit system, phenomenon, units and format, plus a kind of quantity. Each has its own ec_ table
   * and its own xml round trip risk. The KoQ uses the standard Units/Formats schemas, which is the form
   * ECObjects accepts; the custom format is there to exercise ec_Format on its own. */
  const unitsSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestUnits" alias="tu" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="Units" version="01.00.00" alias="u"/>
      <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
      <UnitSystem typeName="TestSystem" displayLabel="Test System" description="Units of measure for this test" />
      <Phenomenon typeName="TestArea" displayLabel="Test Area" definition="LENGTH*LENGTH" />
      <Unit typeName="TestSquareM" displayLabel="Test Square Meter" definition="M*M" numerator="1.0" phenomenon="TestArea" unitSystem="TestSystem" />
      <Unit typeName="TestSquareFt" displayLabel="Test Square Feet" definition="Ft*Ft" numerator="10.0" offset="0.4" phenomenon="TestArea" unitSystem="TestSystem" />
      <Format typeName="TestFormat" displayLabel="Test Format" type="Fractional" showSignOption="OnlyNegative"
              formatTraits="TrailZeroes|KeepSingleZero" precision="4" decimalSeparator="." thousandSeparator="," uomSeparator=" " />
      <KindOfQuantity typeName="TestKoq" displayLabel="Test KoQ" persistenceUnit="u:CM" relativeError="0.001"
                      presentationUnits="f:AmerFI[u:FT][u:IN]" />
      <ECEntityClass typeName="Measured">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECProperty propertyName="len" typeName="double" kindOfQuantity="TestKoq" />
      </ECEntityClass>
  </ECSchema>`;

  /** Enumerations, nested structs, arrays, extended types, property categories. */
  const typesSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestTypes" alias="tt" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEnumeration typeName="Colour" backingTypeName="int" isStrict="true">
          <ECEnumerator name="Red" value="1" displayLabel="Red" />
          <ECEnumerator name="Green" value="2" displayLabel="Green" />
      </ECEnumeration>
      <ECEnumeration typeName="Tag" backingTypeName="string" isStrict="false">
          <ECEnumerator name="Alpha" value="a" />
      </ECEnumeration>
      <PropertyCategory typeName="TestCategory" displayLabel="Test Category" priority="7" />
      <ECStructClass typeName="Inner">
          <ECProperty propertyName="i1" typeName="int" />
          <ECProperty propertyName="i2" typeName="Colour" />
      </ECStructClass>
      <ECStructClass typeName="Outer">
          <ECStructProperty propertyName="inner" typeName="Inner" />
          <ECProperty propertyName="o1" typeName="string" extendedTypeName="Json" />
      </ECStructClass>
      <ECEntityClass typeName="Holder">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECStructProperty propertyName="outer" typeName="Outer" category="TestCategory" />
          <ECStructArrayProperty propertyName="many" typeName="Inner" minOccurs="0" maxOccurs="unbounded" />
          <ECArrayProperty propertyName="numbers" typeName="int" minOccurs="0" maxOccurs="unbounded" />
          <ECProperty propertyName="tag" typeName="Tag" />
      </ECEntityClass>
  </ECSchema>`;

  /** A foreign key relationship with a navigation property, and a link table relationship. */
  const relationshipSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestRel" alias="trl" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECRelationshipClass typeName="ChildRefersToParent" strength="referencing" strengthDirection="Backward" modifier="Sealed">
          <Source multiplicity="(0..1)" roleLabel="refers to" polymorphic="true"><Class class="Child" /></Source>
          <Target multiplicity="(0..1)" roleLabel="is referred to by" polymorphic="true"><Class class="Parent" /></Target>
      </ECRelationshipClass>
      <ECRelationshipClass typeName="ParentsShareChildren" strength="referencing" modifier="None">
          <BaseClass>bis:ElementRefersToElements</BaseClass>
          <Source multiplicity="(0..*)" roleLabel="shares" polymorphic="true"><Class class="Parent" /></Source>
          <Target multiplicity="(0..*)" roleLabel="is shared by" polymorphic="true"><Class class="Child" /></Target>
      </ECRelationshipClass>
      <ECEntityClass typeName="Parent">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECProperty propertyName="label" typeName="string" />
      </ECEntityClass>
      <ECEntityClass typeName="Child">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECProperty propertyName="label" typeName="string" />
          <ECNavigationProperty propertyName="refersTo" relationshipName="ChildRefersToParent" direction="Forward" />
      </ECEntityClass>
  </ECSchema>`;

  const referencedSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestReferenced" alias="trf" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECStructClass typeName="RefStruct"><ECProperty propertyName="s1" typeName="string" /></ECStructClass>
  </ECSchema>`;

  const dependentSchema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDependent" alias="tdp" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="TestReferenced" version="01.00.00" alias="trf"/>
      <ECEntityClass typeName="Dependent">
          <BaseClass>bis:DefinitionElement</BaseClass>
          <ECStructProperty propertyName="d1" typeName="trf:RefStruct" />
      </ECEntityClass>
  </ECSchema>`;

  // --- helpers ---------------------------------------------------------------------------------

  /** The convergence oracle. `ecdbMap` and `sqliteSchema` cover the physical layout. */
  const schemaHashes = async (b: BriefcaseDb) => {
    const read = async (name: "ecdb_schema" | "ecdb_map" | "sqlite_schema") => {
      const result = await b.createQueryReader(`PRAGMA checksum(${name})`).next();
      expect(result.done, `PRAGMA checksum(${name}) returned no rows`).to.be.false;
      return result.value.sha3_256 as string;
    };
    return { ecdbSchema: await read("ecdb_schema"), ecdbMap: await read("ecdb_map"), sqliteSchema: await read("sqlite_schema") };
  };

  const expectConverged = async (expected: BriefcaseDb, actual: BriefcaseDb, what: string) => {
    expect(await schemaHashes(actual), `${what}: metadata or physical layout diverged`).to.deep.equal(await schemaHashes(expected));
  };

  const propNames = (b: BriefcaseDb, classFullName: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return Object.getOwnPropertyNames(b.getMetaData(classFullName).properties);
    } catch {
      return [];
    }
  };

  /** Collects what the resolver was offered, and answers with the given action. */
  const recordPending = (action: SchemaSync.PendingImportAction = "applyPending") => {
    const seen: SchemaSync.PendingImport[] = [];
    SchemaSync.setPendingImportResolver((arg) => {
      seen.push(...arg.pending);
      return action;
    });
    return seen;
  };

  async function initializeContainer(containerProps: { containerId: string, isPublic?: boolean, baseUri: string }) {
    await AzuriteTest.Sqlite.createAzContainer(containerProps);
    const accessToken = await CloudSqlite.requestToken({ ...containerProps });
    await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType });
    return { ...containerProps, accessToken, storageType } as const;
  }

  /** A fresh iModel with schema sync enabled, plus a way to add briefcases to its timeline. */
  const setup = async (containerId: string) => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId });
    const iTwinId = Guid.createValue();

    // A suite that failed before its own shutdown leaves HubMock running, which would make every test
    // here fail on startup for a reason that has nothing to do with schema sync.
    if (HubMock.isValid)
      HubMock.shutdown();

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSyncOrchestration", `${containerId}.bim`);
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSyncOrchestration" } }).close();
    const iModelId = await HubMock.createNewIModel({ accessToken: user1, iTwinId, version0, iModelName: containerId });

    let cacheSeq = 0;
    const openBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      const b = await BriefcaseDb.open(bcProps);
      SchemaSync.setTestCache(b, `${containerId}-${++cacheSeq}`);
      return b;
    };

    const b1 = await openBriefcase(user1);
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1, description: "enable schema sync" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());

    /** A briefcase that joins the timeline as it stands now. */
    const joinBriefcase = async (accessToken: AccessToken) => {
      const b = await openBriefcase(accessToken);
      await b.pullChanges({ accessToken });
      assert.isTrue(b[_nativeDb].schemaSyncEnabled(), "briefcase did not inherit schema sync");
      return b;
    };

    return { b1, joinBriefcase };
  };

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
    // The poc traces what it records and replays under the ECDb category. A failure here is usually a
    // checksum mismatch with no other clue, so keep the import log activity in the output.
    Logger.initializeToConsole();
    Logger.setLevel("ECDb", LogLevel.Info);
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
    Logger.setLevel("ECDb", LogLevel.Error);
  });

  afterEach(() => {
    SchemaSync.setPendingImportResolver(undefined);
    if (HubMock.isValid)
      HubMock.shutdown();
  });

  // --- the resolver's three answers ---------------------------------------------------------------

  it("replays the pending import of another briefcase before importing", async () => {
    const { b1, joinBriefcase } = await setup("orch-apply");
    const b2 = await joinBriefcase(user2);

    // b1 imports and does not push. Only the log knows about it.
    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1", "p2"])]);
    assert.sameOrderedMembers(["p1", "p2"], propNames(b1, "TestPipe:Pipe"));
    assert.isEmpty(propNames(b2, "TestPipe:Pipe"));

    const seen = recordPending();

    // b2 imports something unrelated, so it has to replay b1's import first.
    await b2.importSchemaStrings([valveSchema]);

    expect(seen).to.have.lengthOf(1);
    expect(seen[0].state).to.equal("pending");
    expect(seen[0].timestamp).to.be.greaterThan(0);
    expect(seen[0].guid).to.not.be.empty;
    expect(seen[0].hasDynamicSchema).to.be.false;
    expect(seen[0].schemas).to.include("TestPipe.01.00.00");

    assert.sameOrderedMembers(["p1", "p2"], propNames(b2, "TestPipe:Pipe"));
    assert.sameOrderedMembers(["v1"], propNames(b2, "TestValve:Valve"));

    // Once b1 catches up with b2's import, both have run the same calls in the same order.
    await SchemaSync.pull(b1);
    await expectConverged(b2, b1, "after both caught up");

    b1.close();
    b2.close();
  });

  it("cancels the import when the caller refuses the pending changes", async () => {
    const { b1, joinBriefcase } = await setup("orch-cancel");
    const b2 = await joinBriefcase(user2);

    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1", "p2"])]);

    SchemaSync.setPendingImportResolver(() => "cancel");

    await expect(b2.importSchemaStrings([valveSchema])).to.be.rejectedWith(/pending schema imports from other briefcases/);

    assert.isEmpty(propNames(b2, "TestPipe:Pipe"), "nothing of b1's should have been applied");
    assert.isEmpty(propNames(b2, "TestValve:Valve"), "the local import should not have run");

    b1.close();
    b2.close();
  });

  it("rejects the pending changes and imports anyway", async () => {
    const { b1, joinBriefcase } = await setup("orch-reject");
    const b2 = await joinBriefcase(user2);

    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1", "p2"])]);

    SchemaSync.setPendingImportResolver(() => "reject");
    await b2.importSchemaStrings([valveSchema]);

    assert.isEmpty(propNames(b2, "TestPipe:Pipe"), "b2 rejected b1's import, so it must not have it");
    assert.sameOrderedMembers(["v1"], propNames(b2, "TestValve:Valve"));

    // A rejected record is never offered again, to anyone.
    const offered = recordPending();
    await b1.importSchemaStrings([pipeSchema("01.00.01", ["p1", "p2", "p3"])]);
    expect(offered.map((r) => r.schemas.join(","))).to.deep.equal(["TestValve.01.00.00"], "only b2's import is pending for b1");

    b1.close();
    b2.close();
  });

  // --- convergence over content that actually exercises the mapper ---------------------------------

  it("converges for shared columns and overflow tables", async () => {
    const { b1, joinBriefcase } = await setup("orch-shared-columns");

    const overflowTables = (b: BriefcaseDb) =>
      b.withPreparedSqliteStatement("SELECT count(*) FROM sqlite_master WHERE type='table' AND name LIKE '%Overflow%'", (stmt) => {
        stmt.step();
        return stmt.getValue(0).getInteger();
      });

    // A handful of properties fit in BisCore's shared columns, ninety do not, so the second import
    // has to spill into an overflow table - the decision the mapper makes from file state.
    await b1.importSchemaStrings([sharedColumnSchema("01.00.00", 5)]);
    await b1.importSchemaStrings([sharedColumnSchema("01.00.01", 90)]);
    expect(overflowTables(b1), "the second import should have forced an overflow table").to.be.greaterThan(0);

    const b2 = await joinBriefcase(user2);
    await SchemaSync.pull(b2);
    await expectConverged(b1, b2, "replayed both imports");

    // A briefcase that joins even later replays the same log and must land in the same place.
    const b3 = await joinBriefcase(user3);
    await SchemaSync.pull(b3);
    await expectConverged(b1, b3, "late joiner replayed the whole log");

    b1.close();
    b2.close();
    b3.close();
  });

  it("converges for units, formats, kinds of quantity, enumerations, structs and relationships", async () => {
    const { b1, joinBriefcase } = await setup("orch-rich-content");
    // b2 has to exist before the import: pullChanges catches a briefcase up on the log, so one that
    // joins afterwards would already have replayed it and see nothing pending.
    const b2 = await joinBriefcase(user2);

    // One importSchemas call with several schemas, so this covers the grouping as well as the content.
    await b1.importSchemaStrings([unitsSchema, typesSchema, relationshipSchema]);

    const seen = recordPending();
    await b2.importSchemaStrings([valveSchema]);

    expect(seen, "one call has to stay one record").to.have.lengthOf(1);
    expect(seen[0].schemas, "the whole call has to stay together").to.include.members(["TestUnits.01.00.00", "TestTypes.01.00.00", "TestRel.01.00.00"]);

    // Referencing Units and Formats upgraded them in the file, so they changed too and have to travel
    // with the import even though the caller never named them. Without them a replaying briefcase
    // could not load the graph.
    expect(seen[0].schemas.some((s) => s.startsWith("Units.")), `Units missing from ${seen[0].schemas.join(", ")}`).to.be.true;
    expect(seen[0].schemas.some((s) => s.startsWith("Formats.")), `Formats missing from ${seen[0].schemas.join(", ")}`).to.be.true;

    await SchemaSync.pull(b1);
    await expectConverged(b2, b1, "replayed a multi schema group");

    b1.close();
    b2.close();
  });

  it("records a referenced schema so a replay can load the graph", async () => {
    const { b1, joinBriefcase } = await setup("orch-implicit-ref");
    const b2 = await joinBriefcase(user2);

    await b1.importSchemaStrings([referencedSchema, dependentSchema]);

    const seen = recordPending();
    await b2.importSchemaStrings([valveSchema]);

    expect(seen).to.have.lengthOf(1);
    expect(seen[0].schemas).to.have.members(["TestReferenced.01.00.00", "TestDependent.01.00.00"]);
    expect(propNames(b2, "TestDependent:Dependent")).to.include("d1");

    b1.close();
    b2.close();
  });

  it("carries a dynamic schema whose content changes without a version bump", async () => {
    const { b1, joinBriefcase } = await setup("orch-dynamic");
    const b2 = await joinBriefcase(user2);

    // The DynamicSchema custom attribute is what lets ECDb accept an edit under an unchanged version
    // (see the IsDynamicSchema check in SchemaWriter::ImportSchema). Without it the import is refused.
    const dynamic = (props: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDynamic" alias="tdy" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
        <ECCustomAttributes>
            <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="Dyn">
            <BaseClass>bis:DefinitionElement</BaseClass>
            ${props.map((p) => `<ECProperty propertyName="${p}" typeName="string" />`).join("\n            ")}
        </ECEntityClass>
    </ECSchema>`;

    await b1.importSchemaStrings([dynamic(["d1", "d2"])]);
    await b1.importSchemaStrings([dynamic(["d1", "d2", "d3", "d4"])]);
    assert.sameMembers(["d1", "d2", "d3", "d4"], propNames(b1, "TestDynamic:Dyn"));

    const seen = recordPending();
    await b2.importSchemaStrings([valveSchema]);

    // Same name and version twice, different content - two records, and both flagged as dynamic so a
    // reviewer can see that the version tells them nothing about what changed.
    expect(seen).to.have.lengthOf(2);
    expect(seen.map((r) => r.schemas)).to.deep.equal([["TestDynamic.01.00.00"], ["TestDynamic.01.00.00"]]);
    expect(seen.every((r) => r.hasDynamicSchema), "both records should be flagged dynamic").to.be.true;
    assert.sameMembers(["d1", "d2", "d3", "d4"], propNames(b2, "TestDynamic:Dyn"));

    await SchemaSync.pull(b1);
    await expectConverged(b2, b1, "after replaying two edits of one dynamic schema version");

    b1.close();
    b2.close();
  });

  // --- the changeset side --------------------------------------------------------------------------

  it("merges the changeset of an import a briefcase already replayed", async () => {
    const { b1, joinBriefcase } = await setup("orch-changeset");
    const b2 = await joinBriefcase(user2);

    // b1 imports and holds on to its changeset.
    await b1.importSchemaStrings([sharedColumnSchema("01.00.00", 40)]);

    // b2 replays the same import and pushes first, so b1's push has to land on rows b2 already produced.
    await SchemaSync.pull(b2);
    await expectConverged(b1, b2, "b2 replayed b1's import");
    await b2.pushChanges({ accessToken: user2, description: "b2 pushes the replayed import" });

    await b1.pushChanges({ accessToken: user1, description: "b1 pushes its own copy of the same import" });
    await b2.pullChanges({ accessToken: user2 });
    await expectConverged(b1, b2, "after both pushed the same import");

    // A briefcase that only ever sees the timeline must end up in the same place, and replaying entries
    // it already received as changesets must do nothing.
    const b3 = await joinBriefcase(user3);
    await expectConverged(b1, b3, "b3 got the schema purely from changesets");
    await SchemaSync.pull(b3);
    await expectConverged(b1, b3, "replaying what b3 already has is a no op");

    b1.close();
    b2.close();
    b3.close();
  });

  it("converges when briefcases take turns importing", async () => {
    const { b1, joinBriefcase } = await setup("orch-interleaved");
    const b2 = await joinBriefcase(user2);

    // Each briefcase catches up before it records, so the log order is the order everyone applies.
    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1"])]);
    await b2.importSchemaStrings([valveSchema]);                          // replays b1's import first
    await b1.importSchemaStrings([pipeSchema("01.00.01", ["p1", "p2"])]); // replays b2's import first
    await b2.importSchemaStrings([typesSchema]);                          // replays b1's second import first

    await SchemaSync.pull(b1);
    await expectConverged(b2, b1, "b1 and b2 after four interleaved imports");

    // A late joiner replays all four in log order.
    const b3 = await joinBriefcase(user3);
    await SchemaSync.pull(b3);
    await expectConverged(b2, b3, "late joiner replayed four imports");

    assert.sameOrderedMembers(["p1", "p2"], propNames(b3, "TestPipe:Pipe"));
    assert.sameOrderedMembers(["v1"], propNames(b3, "TestValve:Valve"));

    b1.close();
    b2.close();
    b3.close();
  });

  it("does not record an import that changed nothing, and replaying twice is a no op", async () => {
    const { b1, joinBriefcase } = await setup("orch-idempotent");
    const b2 = await joinBriefcase(user2);

    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1", "p2"])]);
    // Importing the identical schema again changes nothing, so there is nothing for others to replay.
    await b1.importSchemaStrings([pipeSchema("01.00.00", ["p1", "p2"])]);

    const seen = recordPending();
    await b2.importSchemaStrings([valveSchema]);
    expect(seen, "a no op import must not add a record").to.have.lengthOf(1);

    const afterReplay = await schemaHashes(b2);

    // Catching up again finds nothing to do.
    await SchemaSync.pull(b2);
    expect(await schemaHashes(b2)).to.deep.equal(afterReplay);

    b1.close();
    b2.close();
  });
});
