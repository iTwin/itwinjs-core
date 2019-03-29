/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { LogLevel } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { DevTools, IModelApp } from "@bentley/imodeljs-frontend";
import { assert } from "chai";

describe("DevTools", () => {
  let devTools: DevTools;

  before(async () => {
    IModelApp.startup();

    const iModelToken: IModelToken = {
      iModelId: "test",
      changeSetId: "test",
    }; // Supply a real token in an integration test
    devTools = DevTools.connectToBackendInstance(iModelToken);
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("can fetch stats from backend", async () => {
    const stats = await devTools.stats();
    assert.isDefined(stats);
    assert.isDefined(stats.os);
    assert.isDefined(stats.process);
  });

  it("can ping backend", async () => {
    const ret = await devTools.ping(10);
    assert.isTrue(ret);
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
});
