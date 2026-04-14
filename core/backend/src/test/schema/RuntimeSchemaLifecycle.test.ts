/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { expect } from "chai";
import { ChannelControl } from "../../ChannelControl";
import { HubMock } from "../../internal/HubMock";
import { HubWrappers } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

/** Simple test schema that will be imported to test cache lifecycle. */
const testSchemaV1 = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="RuntimeSchemaLifecycleTest" alias="rslt" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="TestElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="PropA" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`;

/** Updated schema with an additional property. */
const testSchemaV2 = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="RuntimeSchemaLifecycleTest" alias="rslt" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="TestElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="PropA" typeName="string"/>
      <ECProperty propertyName="PropB" typeName="int"/>
    </ECEntityClass>
  </ECSchema>`;

describe("RuntimeSchemaContext lifecycle", () => {
  let iModelId: string;

  before(async () => {
    HubMock.startup("RuntimeSchemaLifecycle", KnownTestLocations.outputDir);
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  after(async () => {
    HubMock.shutdown();
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  beforeEach(async () => {
    iModelId = await HubWrappers.createIModel("user1", HubMock.iTwinId, `RSLifecycle-${Guid.createValue()}`);
  });

  afterEach(async () => {
    await HubMock.deleteIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
  });

  it("getSchemas reflects imported schema and refreshSchemas detects token change", async () => {
    // Open a briefcase, get initial context
    const bc = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const ctx1 = await bc.getSchemas();
    expect(ctx1.findClass("RuntimeSchemaLifecycleTest:TestElement")).to.be.undefined;
    expect(ctx1.isOutdated).to.be.false;

    // Import v1 schema - adds TestElement with PropA
    // importSchemaStrings saves changes internally and calls clearCaches, which
    // schedules a background schema token check.
    await bc.importSchemaStrings([testSchemaV1]);

    // refreshSchemas should detect the schema token changed and rebuild
    const ctx2 = await bc.refreshSchemas();
    expect(ctx1.isOutdated).to.be.true;
    expect(ctx2.isOutdated).to.be.false;

    const testClass1 = ctx2.findClass("RuntimeSchemaLifecycleTest:TestElement");
    expect(testClass1).to.not.be.undefined;
    expect(testClass1!.getOwnProperties().find((p) => p.name === "PropA")).to.not.be.undefined;
    expect(testClass1!.getOwnProperties().find((p) => p.name === "PropB")).to.be.undefined;

    // Import v2 schema - adds PropB
    await bc.importSchemaStrings([testSchemaV2]);

    // refreshSchemas picks up the new property
    const ctx3 = await bc.refreshSchemas();
    expect(ctx2.isOutdated).to.be.true;
    expect(ctx3.isOutdated).to.be.false;

    const testClass2 = ctx3.findClass("RuntimeSchemaLifecycleTest:TestElement");
    expect(testClass2).to.not.be.undefined;
    expect(testClass2!.getOwnProperties().find((p) => p.name === "PropB")).to.not.be.undefined;

    bc.close();
  });

  it("getSchemas on second briefcase reflects schema pushed from first", async () => {
    // bc1 imports a schema and pushes
    const bc1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await bc1.importSchemaStrings([testSchemaV1]);
    await bc1.pushChanges({ accessToken: "user1", description: "push v1 schema" });

    // bc2 pulls and should see the new schema
    const bc2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const ctx = await bc2.getSchemas();
    const testClass = ctx.findClass("RuntimeSchemaLifecycleTest:TestElement");
    expect(testClass).to.not.be.undefined;
    expect(testClass!.getOwnProperties().find((p) => p.name === "PropA")).to.not.be.undefined;

    bc1.close();
    bc2.close();
  });

  it("pullChanges invalidates cached runtime schema context", async () => {
    // bc1 will push schema changes; bc2 will pull them
    const bc1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    const bc2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // bc2 gets initial context (no test schema)
    const ctxBefore = await bc2.getSchemas();
    expect(ctxBefore.findClass("RuntimeSchemaLifecycleTest:TestElement")).to.be.undefined;

    // bc1: import v1 + push
    await bc1.importSchemaStrings([testSchemaV1]);
    await bc1.pushChanges({ accessToken: "user1", description: "push v1" });

    // bc2: pull changes
    await bc2.pullChanges();

    // After pulling, the cached context should be stale. clearCaches triggers _scheduleSchemaCheck
    // which runs asynchronously. Use refreshSchemas to force a synchronous recheck.
    const ctxAfterPull = await bc2.refreshSchemas();
    expect(ctxBefore.isOutdated).to.be.true;
    const testClass = ctxAfterPull.findClass("RuntimeSchemaLifecycleTest:TestElement");
    expect(testClass).to.not.be.undefined;

    // bc1: import v2 + push
    await bc1.importSchemaStrings([testSchemaV2]);
    await bc1.pushChanges({ accessToken: "user1", description: "push v2" });

    // bc2: pull again
    await bc2.pullChanges();
    const ctxAfterPull2 = await bc2.refreshSchemas();
    expect(ctxAfterPull.isOutdated).to.be.true;
    const updated = ctxAfterPull2.findClass("RuntimeSchemaLifecycleTest:TestElement");
    expect(updated).to.not.be.undefined;
    expect(updated!.getOwnProperties().find((p) => p.name === "PropB")).to.not.be.undefined;

    bc1.close();
    bc2.close();
  });

  it("concurrent getSchemas calls share a single hydration", async () => {
    const bc = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Fire multiple concurrent getSchemas calls - they should all resolve to the same context
    const [ctx1, ctx2, ctx3] = await Promise.all([
      bc.getSchemas(),
      bc.getSchemas(),
      bc.getSchemas(),
    ]);

    expect(ctx1).to.equal(ctx2);
    expect(ctx2).to.equal(ctx3);
    expect(ctx1.isOutdated).to.be.false;

    bc.close();
  });
});
