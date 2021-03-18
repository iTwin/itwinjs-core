/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "dotenv/config";
import { ConfigMapper } from "./ConfigMapper";
import { Logger } from "@bentley/bentleyjs-core";
import { initJsOperations, setJsConfigMapper } from "./InitJsConnector";
import { nonJsInitOperations, setConfigMapper } from "./InitConnector";
import { IModelHelper } from "./IModelHelper";

let configMapper: ConfigMapper;

async function initOperations() {
  configMapper = new ConfigMapper();
  await configMapper.initializeConfigVariables();
  if (configMapper.bridgeType === "JS") {
    setJsConfigMapper(configMapper);
    await initJsOperations();
  } else {
    setConfigMapper(configMapper);
    await nonJsInitOperations();
  }
}

initOperations()
  .then(() => { })
  .catch(async (err) => {

    const token = await configMapper.imodelServiceToken();

    // IModelBridgeService.updateStatus(token, configMapper.activityId!, configMapper.jobRequestId!, BridgeJobExecutionStatus.Failed);
    Logger.logError("iModelBridgeFwk Wrapper", err);
    IModelHelper.releaseAllIModelHubLocksForCurrentBriefcase(token, configMapper);
    process.exitCode = 1;
  });
