/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, BriefcaseManager, ChannelControl, CloudSqlite, IModelHost, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

const storageType = "azure";

async function initializeContainer(containerProps: { containerId: string; baseUri: string }) {
  await AzuriteTest.Sqlite.createAzContainer(containerProps);
  const accessToken = await CloudSqlite.requestToken({ ...containerProps });
  await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType });
  return { ...containerProps, accessToken, storageType } as const;
}

/** Build a minimal ECSchema XML string with the given entity classes. */
function makeSchema(name: string, ver: string, classes: { name: string; props?: string[] }[]): string {
  const classXml = classes.map(({ name: cn, props = [] }) => {
    const propXml = props.map((p) => `        <ECProperty propertyName="${p}" typeName="string" />`).join("\n");
    return [
      `    <ECEntityClass typeName="${cn}">`,
      `        <BaseClass>bis:Element</BaseClass>`,
      propXml,
      `    </ECEntityClass>`,
    ].filter(Boolean).join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="${name}" alias="${name.toLowerCase().slice(0, 8)}" version="${ver}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
${classXml}
</ECSchema>`;
}

// eslint-disable-next-line @typescript-eslint/no-deprecated
const getPropNames = (db: BriefcaseDb, classFullName: string) =>
  Object.getOwnPropertyNames(db.getMetaData(classFullName).properties);

describe("Schema import with automatic reservation (SchemaSync)", function (this: Suite) {
  this.timeout(0);

  let containerSeq = 0;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  afterEach(() => {
    HubMock.shutdown();
  });

  async function setup(accessToken: AccessToken) {
    const containerId = `schema-import-res-${++containerSeq}`;
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId });
    const iTwinId = Guid.createValue();

    HubMock.startup("schemaImportReservation", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("SchemaImportReservation", `${containerId}.bim`);
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "schemaImportReservation" } }).close();
    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId, version0, iModelName: containerId });

    const openBriefcase = async (token: AccessToken, cacheName: string): Promise<BriefcaseDb> => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken: token });
      const bc = await BriefcaseDb.open(bcProps);
      SchemaSync.setTestCache(bc, cacheName);
      bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      return bc;
    };

    const b1 = await openBriefcase(accessToken, `${containerId}-b1`);
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    assert.isTrue(SchemaSync.isEnabled(b1));

    return { b1, iModelId, iTwinId, openBriefcase, containerProps };
  }

  it("imports a schema with a single class", async () => {
    const token = "token 1";
    const { b1 } = await setup(token);

    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.00", [{ name: "Widget" }])]);

    assert.isTrue(b1.containsClass("TestSchema:Widget"));
    b1.close();
  });

  it("imports a schema with properties on a class", async () => {
    const token = "token 1";
    const { b1 } = await setup(token);

    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.00", [{ name: "Widget", props: ["p1", "p2"] }])]);

    assert.isTrue(b1.containsClass("TestSchema:Widget"));
    assert.deepEqual(getPropNames(b1, "TestSchema:Widget"), ["p1", "p2"]);
    b1.close();
  });

  it("adds a new property by importing an updated schema version", async () => {
    const token = "token 1";
    const { b1 } = await setup(token);

    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.00", [{ name: "Widget", props: ["p1"] }])]);
    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.01", [{ name: "Widget", props: ["p1", "p2"] }])]);

    assert.deepEqual(getPropNames(b1, "TestSchema:Widget"), ["p1", "p2"]);
    b1.close();
  });

  it("adds a new class by importing an updated schema version", async () => {
    const token = "token 1";
    const { b1 } = await setup(token);

    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.00", [{ name: "ClassA" }])]);
    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.01", [{ name: "ClassA" }, { name: "ClassB" }])]);

    assert.isTrue(b1.containsClass("TestSchema:ClassA"));
    assert.isTrue(b1.containsClass("TestSchema:ClassB"));
    b1.close();
  });

  it("second briefcase sees the schema after pulling from the shared channel", async () => {
    const token1 = "token 1";
    const token2 = "token 2";
    const { b1, iTwinId, iModelId, openBriefcase } = await setup(token1);

    const b2 = await openBriefcase(token2, `schema-import-res-${containerSeq}-b2`);
    // b2 pulls to get SchemaSync enabled
    await b2.pullChanges({ accessToken: token2 });
    assert.isTrue(SchemaSync.isEnabled(b2));

    await b1.importSchemaStrings([makeSchema("TestSchema", "01.00.00", [{ name: "Pipe1", props: ["p1", "p2"] }])]);

    // b2 sees the schema via SchemaSync (not yet via Hub changeset)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(getPropNames(b2, "TestSchema:Pipe1"), ["p1", "p2"]);

    b1.close();
    b2.close();
    void iTwinId; void iModelId; // used via closure
  });
});
