/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "dotenv/config";
import { ConfigMapper } from "./ConfigMapper";
import { Logger } from "@bentley/bentleyjs-core";
import { BridgeFrameworkExecutor } from "./BridgeFrameworkExecutor";
import { BridgeExitStatusCode, BridgeJobExecutionStatus } from "./BridgeJobExecutionStatus";
import * as child_process from "child_process";
import { Utilities } from "./Utilities";
import { IModelHelper } from "./IModelHelper";
import { IModelApi } from "./iModelHubManager";
import * as glob from "glob";
import * as path from "path";
import { unlink } from "fs";
import { EventBroadcaster } from "./EventBroadcaster/eventBroadcaster";
import { EventBuilder } from "./EventBroadcaster/eventBuilder";
import { BriefcaseDb } from "@bentley/imodeljs-backend";

// let serviceBusOperation: ServiceBusOperations;
let configMapper: ConfigMapper;
let frameworkExecutor: BridgeFrameworkExecutor;
let firstExecutionCode: number | null = null;
let firstExecutionSignal: string | null = null;
async function bridgeStartListener(childProcess: child_process.ChildProcess) {
  frameworkExecutor.jobCurrentStatus = BridgeJobExecutionStatus.InProgress;
  await EventBroadcaster.tryBroadcastEventIfInitialized(EventBuilder.buildBridgeStartedEvent(configMapper));
  Logger.logInfo("InitConnector", `Child Process Started: ${childProcess.pid}`);
}

function timeOutListener(): void {
  Logger.logInfo("InitConnector", "Time out called()");
}

function closeListener(code: number, signal: string): void {
  Logger.logInfo("InitConnector", `Close Listener ${signal}::${code}`);
}

async function errorListener(err: Error) {
  Logger.logInfo("InitConnector", `Error encountered ${err}`);
  // Update Job Status
  process.exitCode = BridgeExitStatusCode.ProcessNotFound;

  // Incase of error close logging streams
}

function disconnectListener() {
  Logger.logInfo("InitConnector", `disconnectListener called `);
}

// This exit listener will delete the dedicated topic Subscription
async function exitListener(_code: number | null, _signal: string | null) {
  Logger.logInfo("InitConnector",
    `--------------------------------Exit listener called Signal=${_signal} ExitCode=${_code}----------------------------------------------------`
  );
  // Set it on save side
  process.exitCode = _code!;
  Logger.logInfo("InitConnector", `Job status: ${frameworkExecutor.jobCurrentStatus}`);
  await EventBroadcaster.tryBroadcastEventIfInitialized(EventBuilder.buildBridgeCompletedEvent(configMapper, _code!));

  const doCleanupExecution = !!configMapper.IsLastFileInJob && _code === 0;
  Logger.logInfo("InitConnector", `Will do cleanup execution status: ${doCleanupExecution}`);

  if (_signal !== "JNIP_TERM") {
    firstExecutionCode = _code;
    firstExecutionSignal = _signal;

    if (!doCleanupExecution) {
      // Update the status now if we will exit soon
      await updateJobStatusAndReleaseLocks(_signal, _code);
    } else {
      // Release locks needed before cleanup execution
      await releaseAllLocks(firstExecutionCode);
    }
  }

  // wait for CrashpadHandler.exe
  await waitforCrashHandler();

  Logger.logInfo("InitConnector", `Meta data status: last file - ${configMapper.IsLastFileInJob}, will do cleanup - ${doCleanupExecution}`);
  if (doCleanupExecution) {
    await secondIMBFWKExecution();
  } else {
    // Workaround as long as the execution methods will return before it completed execution.
    await cleanStagingDirectory();
    await EventBroadcaster.tryBroadcastEventIfInitialized(EventBuilder.buildWrapperCompletedEvent(configMapper, _code!));
  }

  if (_signal !== "SIGTERM") {
    Logger.logInfo("InitConnector", `Exiting the Process with exit code ${_code}`);
    process.exitCode = _code!;
  } else {
    Logger.logInfo("InitConnector", `Exiting the Process with exit code ${BridgeExitStatusCode.ForceClose}`);
    process.exitCode = BridgeExitStatusCode.ForceClose;
  }
}

async function updateJobStatusAndReleaseLocks(_signal: string | null, _code: number | null) {

  Logger.logTrace(
    "InitConnector",
    `[iModelBridgeService.NodeJsWrapper]: UpdateJobStatusAndReleaseLocks-- Job status updated to: ${frameworkExecutor.jobCurrentStatus}`,
  );

  await releaseAllLocks(_code);
}

async function releaseAllLocks(_code: number | null) {
  const token = await configMapper.imodelServiceToken()!;

  if (
    frameworkExecutor.jobCurrentStatus === BridgeJobExecutionStatus.Canceled ||
    frameworkExecutor.jobCurrentStatus === BridgeJobExecutionStatus.Timeout ||
    IModelHelper.isRequiredReleaseLock(_code)
  ) {
    IModelHelper.releaseAllIModelHubLocksForCurrentBriefcase(token, configMapper);
  } else {
    IModelHelper.releaseSchemaLockForCurrentBriefcase(token, configMapper);
  }
}

function outputStreamListener(data: string): void {
  Logger.logInfo("InitConnector", `${Utilities.getTime()} Data: ${data}`);
}

async function waitforCrashHandler() {
  const processName = "CrashpadHandler";
  let isRunning = await Utilities.isProcessRunning(processName);
  Logger.logInfo("InitConnector", `${Utilities.getTime()} CrashpadHandler Running Pre-Status=${isRunning}`);
  const startTime = Date.now();
  const milliseconds = 600000; // 10 minutes
  while (isRunning && Date.now() - startTime < milliseconds) {
    await Utilities.delay(60); // Wait 60 seconds
    Logger.logInfo("InitConnector", `${Utilities.getTime()} CrashpadHandler Running InLoop-Status=${isRunning}`);
    isRunning = await Utilities.isProcessRunning(processName);
  }
  Logger.logInfo("InitConnector", `${Utilities.getTime()} CrashpadHandler Running Post-Status=${isRunning}`);
}

function overrideBridgeStartListener(childProcess: child_process.ChildProcess): void {
  Logger.logInfo("InitConnector", ` Override Child Process Started: ${childProcess.pid}`);
}

async function overrideExitListener(_code: number | null, _signal: string | null) {
  Logger.logInfo("InitConnector", `Second execution completed with signal:${_code} and code:${_code}`);
  // Attempt to release schema Lock
  Logger.logInfo("InitConnector", `Attempt to release schema lock for second execution`);
  const token = await configMapper.imodelServiceToken();
  IModelHelper.releaseSchemaLockForCurrentBriefcase(token, configMapper);

  Logger.logInfo("InitConnector", `Updating job status after second execution to '${firstExecutionCode}', signal '${firstExecutionSignal}'`);
  await updateJobStatusAndReleaseLocks(firstExecutionSignal, firstExecutionCode);

  Logger.logInfo("InitConnector", `Attempting to Generate meta data for ${configMapper.imodelJobDefId}`);

  const allReferenceIdsFilePath = `${configMapper.stagingDirectory}\\metadata.txt`;
  const hierarchicalIdsFilePath = `${configMapper.stagingDirectory}\\hierarchical_metadata.txt`;
  const allMetadataFilePath = `${configMapper.stagingDirectory}\\allMetadata.txt`;
  let briefcaseDb: BriefcaseDb | undefined;
  const metadata: {
    hierarchy: {
      data?: { [fileId: string]: string[] };
      error?: string;
    };
    repositoryLinkIds: {
      data?: string[];
      error?: string;
    };
  } = { hierarchy: {}, repositoryLinkIds: {} };

  try {
    briefcaseDb = await IModelApi.getBriefcase(
      configMapper.getBuddiCode(),
      configMapper.stagingDirectory!,
      await configMapper.imodelServiceToken()!,
      configMapper.contextId!,
      configMapper.imodelId!
    );
  } catch (err) {
    Logger.logError(
      "InitConnector",
      `[iModelBridgeService.NodeJsWrapper]: OverrideExitListener-- ${new Date().toISOString()} Failed to open briefcase: ${err}`,
    );
    // Replace the stored files to make sure that outdated information is not used
    const errorString = `FAILED: ${err}`;
    Utilities.exportResultsToFile(errorString, allReferenceIdsFilePath);
    Utilities.exportResultsToFile(errorString, hierarchicalIdsFilePath);

    metadata.repositoryLinkIds.error = errorString;
    metadata.hierarchy.error = errorString;
    Utilities.exportResultsToFile(JSON.stringify(metadata), allMetadataFilePath);
  }

  // check if we actualy have the briefcase as the code continues after the previous catch
  if (briefcaseDb && briefcaseDb.isOpen) {
    // all repository link ids are part of the unified allMetadata.txt ONLY
    try {
      Logger.logInfo("InitConnector", `${new Date().toISOString()} Generating repository link ids`);
      metadata.repositoryLinkIds.data = IModelApi.getIModelRepositoryLinkIds(briefcaseDb);
    } catch (err) {
      // sql
      const errorString = `FAILED: ${err}`;
      metadata.repositoryLinkIds.error = errorString;
      Logger.logError(
        "InitConnector",
        `[iModelBridgeService.NodeJsWrapper]: OverrideExitListener-- ${new Date().toISOString()} Failed to generate repository link ids with error: ${err}`,
      );
    }

    // all master and reference ids are part of the old metadata.txt ONLY
    // these may contain less results than all repository link ids due to additional joins in sql query
    try {
      Logger.logInfo("InitConnector", `${new Date().toISOString()} Generating master and reference ids`);
      const ids = IModelApi.getIModelMasterAndReferenceFileIds(briefcaseDb);
      Utilities.exportResultsToFile(JSON.stringify(ids), allReferenceIdsFilePath);
    } catch (err) {
      // sql
      const errorString = `FAILED: ${err}`;
      Utilities.exportResultsToFile(errorString, allReferenceIdsFilePath);
      Logger.logError(
        "InitConnector",
        `[iModelBridgeService.NodeJsWrapper]: OverrideExitListener-- ${new Date().toISOString()} Failed to generate master and reference ids with error: ${err}`,
      );
    }

    // hierarchy is part of the old hierarchical_metadata.txt AND unified allMetadata.txt
    try {
      Logger.logInfo("InitConnector", `${new Date().toISOString()} Generating master to reference id hierarchy`);
      metadata.hierarchy.data = IModelApi.getIModelMasterToReferenceIdsMap(briefcaseDb);
      Utilities.exportResultsToFile(JSON.stringify(metadata.hierarchy.data), hierarchicalIdsFilePath);
    } catch (err) {
      // sql or recursion limit reached
      const errorString = `FAILED: ${err}`;
      metadata.hierarchy.error = errorString;
      Utilities.exportResultsToFile(errorString, hierarchicalIdsFilePath);
      Logger.logError(
        "InitConnector",
        `[iModelBridgeService.NodeJsWrapper]: OverrideExitListener-- ${new Date().toISOString()} Failed to generate master to reference ids map with error: ${err}`,
      );
    }

    const metadataString = JSON.stringify(metadata);
    Logger.logInfo("InitConnector", `metadata: ${metadataString}`);
    Utilities.exportResultsToFile(metadataString, allMetadataFilePath);

    briefcaseDb.close();
  }

  await cleanStagingDirectory();

  await EventBroadcaster.tryBroadcastEventIfInitialized(EventBuilder.buildWrapperCompletedEvent(configMapper, process.exitCode ?? 0));
  await waitforCrashHandler();
}

async function cleanStagingDirectory() {
  const filePattern = configMapper.cleanupFilePattern;
  if (filePattern === undefined || filePattern.length === 0) {
    return;
  }

  Logger.logInfo("InitConnector", `Looking for files to cleanup using filepattern ${filePattern}`);

  // finds files that shall be removed via a filepatter glob in the current staging directory. If no file
  // matches the pattern the method can be left.
  const matchedFiles = await new Promise<string[] | null>((resolve, reject) => {
    glob(filePattern, { cwd: configMapper.stagingDirectory! }, (error, matches) => {
      if (error !== null) reject(error);
      else resolve(matches);
    });
  });

  if (matchedFiles === null || matchedFiles.length === 0) {
    Logger.logInfo("InitConnector", "No files to clean up in staging directory.");
    return;
  }

  Logger.logInfo("InitConnector", `Clean staging directory and remove the following files:`);
  for (const fileName of matchedFiles) {
    const absolutePath = path.resolve(configMapper.stagingDirectory!, fileName);
    await new Promise((resolve) =>
      unlink(absolutePath, (error) => {
        if (error) {
          Logger.logInfo("InitConnector", `Failed to delete file ${fileName} from staging directory with error: ${error}`);
        }

        resolve();
      })
    );
  }
}

async function secondIMBFWKExecution() {
  Logger.logInfo("InitConnector", "Second IMBFWK execution started");
  const rspFile = await configMapper.createUpdateRspFile("updatedBridgeargs.rsp");
  const secondFrameworkExecutor = new BridgeFrameworkExecutor(configMapper.frameworkExePath!, rspFile, configMapper.getLogTimeOut())
    .setTimeoutAllowed(configMapper.isTimeoutAllow)
    .setTimeOut(configMapper.jobTimeout)
    .setBridgeStartListener(overrideBridgeStartListener)
    .setTimeoutListener(timeOutListener)
    .setCloseListener(closeListener)
    .setOutPutStream(outputStreamListener)
    .setErrorListener(errorListener)
    .setDisconnectListener(disconnectListener)
    .setExitListener(overrideExitListener);

  await secondFrameworkExecutor.executeBridgeJob();
}
export function setConfigMapper(config: ConfigMapper){
  configMapper = config;
}
export async function nonJsInitOperations() {
  // configMapper = new ConfigMapper();
  // Logger.logInfo("InitConnector", "Initialize Config variables\n");
  // await configMapper.initializeConfigVariables();

  if (configMapper.syncRunId) {
    // Task From V2
    Logger.logInfo("InitConnector",
      `Job Information\n RunId : ${configMapper.syncRunId}, JobId : ${configMapper.azureJobId}\n TaskId : ${configMapper.azureTaskId}, AzureBatchPoolId : ${configMapper.azureBatchPoolId}\n`
    );
  } else {
    // Task From V1
    Logger.logInfo("InitConnector", `Job Information\n ActivityId : ${configMapper.activityId}, AzureBatch PoolId: ${configMapper.azureBatchPoolId}\n`);
  }

  await EventBroadcaster.tryInitialize(configMapper);
  await EventBroadcaster.tryBroadcastEventIfInitialized(EventBuilder.buildWrapperStartedEvent(configMapper));
  if(configMapper.jobRequestId !== undefined && configMapper.jobRequestId === "smoke-test"){
    Logger.logInfo("InitConnector", "initOperations: Skipping token generation for smoke test\n");
  } else{
    Logger.logInfo("InitConnector", "Export Token\n");
    try {
      await configMapper.exportToken();
    } catch(e) {
      Logger.logInfo("InitConnector", "Export Token failed\n");
      process.exitCode = BridgeExitStatusCode.AuthenticationFailed;
      await EventBroadcaster.tryBroadcastEventIfInitialized(
        EventBuilder.buildWrapperCompletedEvent(configMapper, BridgeExitStatusCode.AuthenticationFailed, "Export token failed")
      );
      return;
    }
  }

  const rspFile = await configMapper.createRspFile("bridgeargs.rsp");
  await configMapper.printBasicJobDetails();

  Logger.logInfo("InitConnector", rspFile);
  Logger.logInfo("InitConnector", `configMapper.jobTimeout: ${configMapper.jobTimeout}`);
  Logger.logInfo("InitConnector", `configMapper.logjobTimeout: ${configMapper.getLogTimeOut()}`);

  const delayMinutesBeforeBridging = configMapper.delayMinutesBeforeBridging;
  if (delayMinutesBeforeBridging) {
    Logger.logInfo("InitConnector", `Delaying bridge execution for minutes: ${delayMinutesBeforeBridging}`);
    await Utilities.delayInformativelyForMinutes(delayMinutesBeforeBridging);
  }
  Logger.logInfo("iModelBridgeFwk Wrapper", `[iModelBridgeService.NodeJsWrapper]: Node Js Wrapper execution started`);
  // // Create a dedicated topic subscription
  // await serviceBusOperation.createDedicatedTopicSubscription();

  // // Get IModel Bridge Executor
  frameworkExecutor = new BridgeFrameworkExecutor(configMapper.frameworkExePath!, rspFile, configMapper.getLogTimeOut())
    .setTimeoutAllowed(configMapper.isTimeoutAllow)
    .setTimeOut(configMapper.jobTimeout)
    .setBridgeStartListener(bridgeStartListener)
    .setTimeoutListener(timeOutListener)
    .setCloseListener(closeListener)
    .setOutPutStream(outputStreamListener)
    .setErrorListener(errorListener)
    .setDisconnectListener(disconnectListener)
    .setExitListener(exitListener);

  await frameworkExecutor.executeBridgeJob();
  Logger.logInfo("InitConnector", `Timeout::${configMapper.isTimeoutAllow}`);
  Logger.logInfo("iModelBridgeFwk Wrapper", `[iModelBridgeService.NodeJsWrapper]: Timeout::${configMapper.isTimeoutAllow}`);
  Logger.logInfo("iModelBridgeFwk Wrapper", `[iModelBridgeService.NodeJsWrapper]: BuildNumber:: ${configMapper.buildNumber}`);
  Logger.logInfo("InitConnector", `BuildNumber:: ${configMapper.buildNumber}`);
  Logger.logInfo("InitConnector", `Bridge Name:: ${configMapper.bridgeName}`);
  Logger.logInfo("InitConnector", `Last File:: ${configMapper.IsLastFileInJob}`);
  // Allow the dedicated subscription to recv messages from the conversion service to cancel the job
  Logger.logInfo("InitConnector", `Job status: ${frameworkExecutor.jobCurrentStatus}`);
  // To Do: Temporary fix for canceling jobs
  // if (msg.length > 0)
  //   await frameworkExecutor.killBridgeJob();
  Logger.logInfo("InitConnector", `Closing server ...`);
}

// configMapper = new ConfigMapper();
// void configMapper.initializeConfigVariables().then(() => {
//   nonJsInitOperations()
//     .then(() => { })
//     .catch(async (err) => {

//       Logger.logError("InitConnector", `[iModelBridgeService.NodeJsWrapper]:Failed with error: ${err}`);
//       Logger.logTrace("InitConnector", `[iModelBridgeService.NodeJsWrapper]:Job status updated to: ${BridgeJobExecutionStatus.Failed}`);

//       await EventBroadcaster.tryBroadcastEventIfInitialized(
//         EventBuilder.buildWrapperCompletedEvent(configMapper, 1, "Error when initializing bridging")
//       );
//       process.exitCode = 1;
//     });
// });
