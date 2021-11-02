/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { LogLevel } from "@itwin/core-bentley";
import { DevTools, IModelConnection } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

describe("DevTools", () => {
  let iModel: IModelConnection;
  let devTools: DevTools;

  before(async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runDevToolsRpcTests)
      this.skip();

    iModel = await testContext.iModelWithChangesets!.getConnection();
    devTools = DevTools.connectToBackendInstance(iModel.getRpcProps());
  });

  it("can fetch stats from backend", async () => {
    const stats = await devTools.stats();
    assert.isDefined(stats);
    assert.isDefined(stats.os);
    assert.isDefined(stats.process);
  });

  it("can ping backend", async () => {
    const ret = await devTools.ping(10);
    assert.isDefined(ret.avg);
    assert.isDefined(ret.max);
    assert.isDefined(ret.min);
  });

  it("can set log level", async () => {
    const loggerCategory = "test-category";

    const firstLevel = LogLevel.Info;
    await devTools.setLogLevel(loggerCategory, firstLevel);

    const secondLevel = LogLevel.Warning;
    const actualFirstLevel = await devTools.setLogLevel(loggerCategory, secondLevel);
    assert.equal(actualFirstLevel, firstLevel);

    const thirdLevel = LogLevel.Error;
    const acutalSecondLevel = await devTools.setLogLevel(loggerCategory, thirdLevel);
    assert.equal(acutalSecondLevel, secondLevel);
  });

  it("can get the versions", async () => {
    const versions = await devTools.versions();
    assert.isDefined(versions.application);
    assert.isDefined(versions.iModelJs);
  });
});
