/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, BriefcaseManager, ChannelControl, CloudSqlite, DrawingCategory, HubMock, IModelDb, IModelHost, SchemaSync, SnapshotDb, SqliteStatement } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbResult, Guid, Id64String, OpenMode } from "@itwin/core-bentley";
import * as path from "path";
import { EOL } from "os";
import { ChangesetType, Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
const storageType = "azure" as const;
interface TinySchemaRef {
  name: string;
  ver: string;
  alias: string;
  comment?: string;
}
interface TinyProp {
  kind: "primitive" | "struct";
  name: string;
  comment?: string;
}
interface TinyPrimitiveProp extends TinyProp {
  kind: "primitive";
  type: "string" | "int" | "double" | "long";
}
interface TinyStructProp extends TinyProp {
  kind: "struct";
  type: string;
}
interface TinyClass {
  type: "entity" | "struct";
  name: string;
  baseClass?: string;
  props?: (TinyPrimitiveProp | TinyStructProp)[];
  comment?: string;
}
interface TinySchema extends TinySchemaRef {
  refs?: TinySchemaRef[];
  classes?: TinyClass[];
}
const tinySchemaToXml = (s: TinySchema) => {
  const xml: string[] = [];
  const pad = (i: number) => "".padEnd(i * 4, " ");
  xml.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xml.push(`<ECSchema schemaName="${s.name}" alias="${s.alias}" version="${s.ver}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">`);
  xml.push(...s.refs ? s.refs.map((v) => `${pad(1)}<ECSchemaReference name="${v.name}" version="${v.ver}" alias="${v.alias}"/>`) : []);
  for (const c of s.classes ?? []) {
    const classType = c.type === "entity" ? "ECEntityClass" : "ECStructClass";
    xml.push(`${pad(1)}<${classType} typeName="${c.name}">`);
    if (c.baseClass) {
      xml.push(`${pad(2)}<BaseClass>${c.baseClass}</BaseClass>`);
    }
    for (const p of c.props ?? []) {
      if (p.kind === "primitive") {
        const prop = p;
        xml.push(`${pad(2)}<ECProperty propertyName="${prop.name}" typeName="${prop.type}" />`);
      } else {
        const prop = p;
        xml.push(`${pad(2)}<ECStructProperty propertyName="${prop.name}" typeName="${prop.type}" />`);
      }
    }
    xml.push(`${pad(1)}</${classType}>`);
  }
  xml.push(`</ECSchema>`);
  return xml.join(EOL);
};
const queryPropNames = (b: BriefcaseDb, className: string) => {
  try {
    return Object.getOwnPropertyNames(b.getMetaData(className).properties);
  } catch { return []; }
};
const assertChangesetTypeAndDescr = async (b: BriefcaseDb, changesetType: ChangesetType, description: string) => {
  const cs = await HubMock.getLatestChangeset({ iModelId: b.iModelId });
  expect(cs.changesType).is.eq(changesetType);
  expect(cs.description).is.eq(description);
};
const importSchema = async (b: BriefcaseDb, s: TinySchema) => {
  await b.importSchemaStrings([tinySchemaToXml(s)]);
  b.saveChanges();
};
const queryProfileVer = (db: BriefcaseDb) => {
  return db.withPreparedSqliteStatement("SELECT StrData FROM be_Prop WHERE Namespace='ec_Db' and Name='SchemaVersion'", (stmt: SqliteStatement) => {
    if (stmt.step() === DbResult.BE_SQLITE_ROW)
      return stmt.getValue(0).getString();
    return "";
  });
};
const querySchemaSyncDataVer = (b: BriefcaseDb) => {
  const js = b.queryFilePropertyString({ namespace: "ec_Db", name: "localDbInfo" });
  if (js) {
    return JSON.parse(js).dataVer;
  }
};
async function assertThrowsAsync<T>(test: () => Promise<T>, msg?: string) {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error && msg) {
      assert.equal(e.message, msg);
    }
    return;
  }
  throw new Error(`Failed to throw error with message: "${msg}"`);
};
async function initializeContainer(containerProps: { containerId: string, isPublic?: boolean, baseUri: string }) {
  await AzuriteTest.Sqlite.createAzContainer(containerProps);
  const accessToken = await CloudSqlite.requestToken({ ...containerProps });
  await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType });
  return { ...containerProps, accessToken, storageType };
};

describe("Schema synchronization", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  const synchronizeSchemas = async (iModel: IModelDb) => {
    await SchemaSync.withLockedAccess(iModel, { openMode: OpenMode.Readonly, operationName: "schemaSync" }, async (syncAccess) => {
      const uri = syncAccess.getUri();
      iModel[_nativeDb].schemaSyncPull(uri);
      iModel.clearCaches();
    });
  };

  const imodelJsCoreDirname = path.join(__dirname, `../../../../..`);

  it("multi user workflow", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b2 from shared schema channel
    await synchronizeSchemas(b2);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // add new properties in b2
    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b2.importSchemaStrings([schema2]);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b1 from shared schema channel
    await synchronizeSchemas(b1);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();

    HubMock.shutdown();
  });
  it("import same schema from different briefcase", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1a");
    SchemaSync.setTestCache(b2, "briefcase2a");
    SchemaSync.setTestCache(b3, "briefcase3a");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b2 from shared schema channel
    await synchronizeSchemas(b2);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // import same schema from another briefcase
    await b2.importSchemaStrings([schema1]);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b1 from shared schema channel
    await synchronizeSchemas(b1);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();

    HubMock.shutdown();
  });
  it("override schema sync container", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      },
      ],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);

    // B2 pull changes will pull changeset that enable schema sync and followed by
    // SchemaSync.pull() will get new schema that is not been pushed to hub yet.
    await b2.pullChanges();
    assert.equal(querySchemaSyncDataVer(b2), "0x2");
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0"]);

    await b2.pushChanges({ description: "Test1 schema push" });
    // B2 switch container
    const newContainerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    await assertThrowsAsync(
      async () => SchemaSync.initializeForIModel({ iModel: b2, containerProps: newContainerProps }),
      "Local db already initialized to schema sync (container-id: imodel-sync-itwin-1)");

    await SchemaSync.initializeForIModel({ iModel: b2, containerProps: newContainerProps, overrideContainer: true });
    assert.equal(querySchemaSyncDataVer(b2), "0x2");
    await importSchema(b2, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" }, /* New property added by B2 using new imodel-sync-itwin-2 */
        ],
      },
      ],
    });
    assert.equal(querySchemaSyncDataVer(b2), "0x3");
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);

    // B1 still point to old container and should not see p1
    await SchemaSync.pull(b1);
    assert.equal(querySchemaSyncDataVer(b1), "0x2");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B2 using new imodel-sync-itwin-1 */
        ],
      },
      ],
    });
    assert.equal(querySchemaSyncDataVer(b1), "0x3");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p2"]);

    // Pull will switch the container and changes done by b0 after it was switch on time line.
    await b1.pullChanges();

    assert.equal(querySchemaSyncDataVer(b1), "0x3");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);

    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B2 using new imodel-sync-itwin-2 */
        ],
      },
      ],
    });
    assert.equal(querySchemaSyncDataVer(b1), "0x4");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);

    assert.equal(querySchemaSyncDataVer(b2), "0x3");
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    await SchemaSync.pull(b2);
    assert.equal(querySchemaSyncDataVer(b2), "0x4");
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1", "p2"]);

    await b3.pullChanges();
    assert.equal(querySchemaSyncDataVer(b3), "0x4");
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2"]);

    await b3.pushChanges({ description: "b3 push" });
    await b2.pushChanges({ description: "b2 push" });
    await b1.pushChanges({ description: "b1 push" });

    // Expected history on master
    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Test1 schema push",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "Overriding SchemaSync for iModel with container-id: imodel-sync-itwin-2",
      changesType: 0,
      briefcaseId: 3,
    }, {
      description: "b3 push",
      changesType: 65,
      briefcaseId: 4,
    }, {
      description: "b2 push",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "b1 push",
      changesType: 65,
      briefcaseId: 2,
    },
    ];
    assert.deepEqual(masterHistory, expectedHistory);

    [b1, b2, b3].forEach((b) => {
      b.saveChanges();
      b.close();
    });
    HubMock.shutdown();
  });
  it("test schema sync with profile and domain schema upgrade", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);

    // Setup seed file from existing 4.0.0.3 imodel
    const testFile = SnapshotDb.openDgnDb({ path: path.join(imodelJsCoreDirname, "core/backend/lib/cjs/test/assets/test_ec_4003.bim") }, OpenMode.ReadWrite);
    const version0 = testFile.getFilePath();
    testFile.closeFile();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1Props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken: user1AccessToken });
    let b1 = await BriefcaseDb.open(b1Props);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    // 1. B1 import a new schema
    // 2. B1 push it changes
    // 3. B1 enable schema sync (require schema lock + push changeset)
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      },
      ],
    });

    assert.isUndefined(querySchemaSyncDataVer(b1), "SchemaSync data version should be undefined as its not initialized");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);
    // should fail as there are pending changeset.
    await assertThrowsAsync(
      async () => SchemaSync.initializeForIModel({ iModel: b1, containerProps }),
      "Enabling SchemaSync for iModel failed. There are unsaved or un-pushed local changes.");

    // push changes and then retry.
    await b1.pushChanges({ description: "schema changes" });
    await assertChangesetTypeAndDescr(b1, ChangesetType.Schema, "schema changes");
    // initialize also save and push changeset.
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    assert.equal(querySchemaSyncDataVer(b1), "0x1", "SchemaSync data version should be set");
    await assertChangesetTypeAndDescr(b1, ChangesetType.Regular, "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1");

    // Make sure all briefcases are on the same profile version 4.0.0.3
    const initialProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":3}`);
    let b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b1ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b1ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b1ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b2ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b2ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b2ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b3ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b3ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b3ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    b1.close();

    // 4. B1 profile/schema upgrade
    //    * With schema sync is on following will be done while holding write lock to container.
    //      * Push profile changeset
    //      * PUsh schema changeset
    // 5. B1 modify schema add new property but do not push to hub. But it will be push to SchemaSync container.
    await BriefcaseDb.upgradeSchemas(b1Props);
    b1 = await BriefcaseDb.open(b1Props);
    assert.equal(querySchemaSyncDataVer(b1), "0x3", "profile & domain schema upgrade should change dataVer from 0x1 -> 0x3");
    await assertChangesetTypeAndDescr(b1, ChangesetType.SchemaSync, "Upgraded domain schemas");
    // upgradeSchema() also push changes.
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.equal(querySchemaSyncDataVer(b1), "0x4", "Test1 schema update should change it from 0x3 -> 0x4");

    // 6. B2 import new schema but should fail as it does not see SchemaSync enable so it attempt acquire schema lock
    await assertThrowsAsync(async () => importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    }), "pull is required to obtain lock");
    assert.isUndefined(querySchemaSyncDataVer(b2), "should be undefined in B2");
    b2.abandonChanges();

    // 7. B2 pull changes it will get to point where profile/schema was upgraded.
    //    * SchemaSync pull will also be executed to bring local briefcase schema in line with schema sync container.
    await b2.pullChanges();
    assert.equal(querySchemaSyncDataVer(b1), "0x4", "Last push from B1 should 0x3 though after pullChanges() we do SchemaSync.Pull()");
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    await importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b2), "0x5", "Schema import should change it from 0x4 -> 0x5");
    // Added by b1 but not pushed to hub.
    // p1 property is visible to B2 because of SchemaSync.pull() which happen during pullChanges()
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);

    // B2 add new property p2 to Test1 schema
    await importSchema(b2, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B2*/
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b2), "0x6", "Schema import should change it from 0x5 -> 0x6");
    // B2 should see its local changes and it has not pushed to up only to SchemaSync
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);

    // B1 should see its local changes as it has not grab new changes from Hub or SchemaSync as of yet
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), []);

    // B1 pull new changes from SchemaSync
    assert.equal(querySchemaSyncDataVer(b1), "0x4");
    await SchemaSync.pull(b1);
    assert.equal(querySchemaSyncDataVer(b1), "0x6");

    // B1 after SchemaSYnc.pull should see any new changes made by other briefcases in this case made by B2
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), ["p0"]);

    // B3 does nothing this point and it does not even know Schema Sync is enabled.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 will not be able to pull any changes as its does not even know if container was setup.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    await SchemaSync.pull(b3); // has no effect as b3 does not know if imodel has schema sync enabled.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 pull changes from hub and now it should be at point where profile/schema was upgraded and SchemaSync was init.
    // B3 pull changes will also do SchemaSync.pull so latest view of schema will be visible.
    await b3.pullChanges();
    assert.equal(querySchemaSyncDataVer(b3), "0x6");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), ["p0"]);

    // B3 add new properties to Test1 & Test2 schema.
    await importSchema(b3, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.03",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p1", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p2", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3*/
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b3), "0x7");
    await importSchema(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p1", type: "string" }, /* New property added by B3 */
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B3  */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3  */
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b3), "0x8");
    // B3 local view should confirm the schema changes.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);

    // Test all 3 briefcases for the upgraded profile version 4.0.0.X (where X is at least 4)
    const updatedProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":4}`);
    b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b1ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b1ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b1ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b2ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b2ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b2ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b3ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b3ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b3ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    // B1, B2 & B3 should be able to push there schema changes to hub.
    // This can create duplicate INSERTs/UPDATEs/DELETEs
    assert.equal(querySchemaSyncDataVer(b1), "0x6");
    assert.equal(querySchemaSyncDataVer(b2), "0x6");
    assert.equal(querySchemaSyncDataVer(b3), "0x8");
    await b1.pushChanges({ description: "final push by b1" });
    await b2.pushChanges({ description: "final push by b2" });
    await b3.pushChanges({ description: "final push by b3" });
    assert.equal(querySchemaSyncDataVer(b1), "0x8");
    assert.equal(querySchemaSyncDataVer(b2), "0x8");
    assert.equal(querySchemaSyncDataVer(b3), "0x8");

    (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    // A new briefcase B4 should be able to apply change history with no local changes.
    const b4 = await openNewBriefcase(user3AccessToken);
    SchemaSync.setTestCache(b4, "briefcase4a");
    assert.equal(querySchemaSyncDataVer(b4), "0x8");
    assert.deepEqual(queryPropNames(b4, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b4, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.equal(querySchemaSyncDataVer(b4), "0x8");

    // Expected history on master
    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "schema changes",
      changesType: 1,
      briefcaseId: 2,
    }, {
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Upgraded profile",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Upgraded domain schemas",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "final push by b1",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "final push by b2",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "final push by b3",
      changesType: 65,
      briefcaseId: 4,
    },
    ];
    assert.deepEqual(masterHistory, expectedHistory);

    [b1, b2, b3, b4].forEach((b) => {
      b.saveChanges();
      b.close();
    });
    HubMock.shutdown();
  });
  it("import schema acquire schema lock when need to transform data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";
    const user4AccessToken = "token 4";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);
    const b4 = await openNewBriefcase(user4AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1a");
    SchemaSync.setTestCache(b2, "briefcase2a");
    SchemaSync.setTestCache(b3, "briefcase3a");
    SchemaSync.setTestCache(b4, "briefcase4a");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    const sequence = (start: number, stop: number, step: number = 1) => Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + (i * step));

    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 10).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });
    await b1.pushChanges({ description: "schema with 5 props" });

    await b2.pullChanges();
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 30).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });

    await assertThrowsAsync(async () => b2.acquireSchemaLock(), "exclusive lock is already held");
    await assertThrowsAsync(async () => b3.acquireSchemaLock(), "exclusive lock is already held");

    await importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 10).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });

    await b3.pullChanges();
    await assertThrowsAsync(async () => importSchema(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 30).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    }), "exclusive lock is already held");

    await b1.pushChanges({ description: "schema with 30 props in test1:Pipe1" });
    await b3.pullChanges();
    // now b3 should be able to import schema as b1 has pushed changes to hub.
    await importSchema(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 30).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });

    await b2.pushChanges({ description: "schema with 10 props in test2:Pipe1" });
    await b3.pushChanges({ description: "schema with 30 props in test2:Pipe1" });

    await b4.pullChanges();

    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-2",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "schema with 5 props",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "schema with 30 props in test1:Pipe1",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "schema with 10 props in test2:Pipe1",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "schema with 30 props in test2:Pipe1",
      changesType: 65,
      briefcaseId: 4,
    }];

    assert.deepEqual(masterHistory, expectedHistory);
    [b1, b2, b3, b4].forEach((b) => {
      b.saveChanges();
      b.close();
    });
    HubMock.shutdown();
  });
  it.only("revert timeline changes", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });
    HubMock.startup("test", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iModelName = "test";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    let nProps = 0;
    // 1. Import schema with class that span overflow table.
    const addPropertyAndImportSchema = async (b: BriefcaseDb) => {
      ++nProps;
      const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00.${nProps}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array(nProps).fill(undefined).map((_, i) => `<ECProperty propertyName="p${i + 1}" typeName="string"/>`).join("\n")}
        </ECEntityClass>
    </ECSchema>`;
      await b.importSchemaStrings([schema]);
    };
    await addPropertyAndImportSchema(b1);
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(b1, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(b1, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(b1, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    b1.saveChanges();
    await b1.pushChanges({ description: "setup category", accessToken: adminToken });

    const createEl = async (args: { [key: string]: any }) => {
      await b1.locks.acquireLocks({ exclusive: drawingModelId });
      const geomArray: Arc3d[] = [
        Arc3d.createXY(Point3d.create(0, 0), 5),
        Arc3d.createXY(Point3d.create(5, 5), 2),
        Arc3d.createXY(Point3d.create(-5, -5), 20),
      ];
      process.env
      const geometryStream: GeometryStreamProps = [];
      for (const geom of geomArray) {
        const arcData = IModelJson.Writer.toIModelJson(geom);
        geometryStream.push(arcData);
      }

      const e1 = {
        classFullName: `TestDomain:Test2dElement`,
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        geom: geometryStream,
        ...args,
      };
      return b1.elements.insertElement(e1);;
    };
    const updateEl = async (id: Id64String, args: { [key: string]: any }) => {
      await b1.locks.acquireLocks({ exclusive: id });
      const updatedElementProps = Object.assign(b1.elements.getElementProps(id), args);
      b1.elements.updateElement(updatedElementProps);
    }

    const deleteEl = async (id: Id64String) => {
      await b1.locks.acquireLocks({ exclusive: id });
      b1.elements.deleteElement(id);
    };
    const getChanges = async () => {
      return HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir: path.join(KnownTestLocations.outputDir, rwIModelId, "changesets") });
    };

    const findEl = (id: Id64String) => {
      try {
        return b1.elements.getElementProps(id);
      } catch (e) {
        return undefined;
      }
    }
    // 2. Insert a element for the class
    const el1 = await createEl({ p1: "test1" });
    const el2 = await createEl({ p1: "test2" });
    b1.saveChanges();
    await b1.pushChanges({ description: "insert 2 elements" });

    // 3. Update the element.
    await updateEl(el1, { p1: "test3" });
    b1.saveChanges();
    await b1.pushChanges({ description: "update element 1" });

    // 4. Delete the element.
    await deleteEl(el2);
    const el3 = await createEl({ p1: "test4" });
    b1.saveChanges();
    await b1.pushChanges({ description: "delete element 2" });

    // 5. import schema and insert element 4 & update element 3
    await addPropertyAndImportSchema(b1);
    const el4 = await createEl({ p1: "test5", p2: "test6" });
    await updateEl(el3, { p1: "test7", p2: "test8" });
    b1.saveChanges();
    await b1.pushChanges({ description: "import schema, insert element 4 & update element 3" });

    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);
    // 6. Revert to timeline 2
    await b2.revertAndPushChanges({ toIndex: 3, description: "revert to timeline 2" });

    assert.equal((await getChanges()).at(-1)!.description, "revert to timeline 2");
    await b1.pullChanges();
    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);

    await b2.revertAndPushChanges({ toIndex: 7, description: "reinstate last reverted changeset" });
    assert.equal((await getChanges()).at(-1)!.description, "reinstate last reverted changeset");
    await b1.pullChanges();
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);

    await addPropertyAndImportSchema(b1);
    const el5 = await createEl({ p1: "test9", p2: "test10", p3: "test11" });
    await updateEl(el1, { p1: "test12", p2: "test13", p3: "test114" });
    b1.saveChanges();
    await b1.pushChanges({ description: "import schema, insert element 5 & update element 1" });
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    //skip schema changes & auto generated comment
    await b1.revertAndPushChanges({ toIndex: 2, skipSchemaChanges: true });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 9 to 2 (schema changes skipped)");
    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    assert.isUndefined(findEl(el5));
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    await b1.revertAndPushChanges({ toIndex: 10 });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 10 to 10 (schema changes skipped)");
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.isDefined(findEl(el5));
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);
    b1.close();
    b2.close();
    HubMock.shutdown();
  });
});
