/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus, Logger } from "@bentley/bentleyjs-core";
import {AccessToken, AuthorizedClientRequestContext} from "@bentley/itwin-client";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { BridgeJobDefArgs, BridgeRunner } from "../imodel-bridge";
import { ServerArgs } from "../IModelHubUtils";
import { ConfigMapper } from "./ConfigMapper";
import { IModelHelper } from "./IModelHelper";
import { UrlFileHandler } from "@bentley/backend-itwin-client";
import {ProjectShareClient, ProjectShareFileQuery} from "@bentley/projectshare-client";

let configMapper: ConfigMapper;

async function initOperations() {
  Logger.initializeToConsole();
  Logger.setLevelDefault(1);
  configMapper = new ConfigMapper();
  await configMapper.initializeConfigVariables();

  // Set up iModelHost
  const config = new IModelHostConfiguration();
  config.concurrentQuery.concurrent = 4; // for test restrict this to two threads. Making closing connection faster
  config.cacheDir = configMapper.stagingDirectory;
  await IModelHost.startup(config);

  // Set up bridgeRunner arguments

  const bridgeJobDef = new BridgeJobDefArgs();
  bridgeJobDef.sourcePath = configMapper.inputFileName;
  bridgeJobDef.bridgeModule = configMapper.frameworkExePath;
  bridgeJobDef.outputDir = configMapper.stagingDirectory;
  bridgeJobDef.documentGuid = configMapper.documentGuid;
  const serverArgs = new ServerArgs();
  serverArgs.contextId = configMapper.contextId;
  serverArgs.iModelId = configMapper.imodelId;
  bridgeJobDef.dmsServerUrl = configMapper.repositoryUrl;
  bridgeJobDef.dmsAccessToken = configMapper.thirdPartyToken;
  serverArgs.getToken = async (): Promise<AccessToken> => {
    const token = await configMapper.imodelServiceToken(); // This line won't work a token provider being initialized, need to get a token elsewhere
    return AccessToken.fromTokenString(token);
  };
  if (bridgeJobDef.dmsServerUrl && bridgeJobDef.sourcePath && configMapper.workingDir) {
    // this whole if block is for downloading external files if your connector requires that in some cases
    const token = await serverArgs.getToken();
    const requestContext = new AuthorizedClientRequestContext(token);
    try {
      const urlToDownload = await getDownloadableUrl(requestContext, configMapper.dmsType!, bridgeJobDef.dmsServerUrl, serverArgs.contextId!);
      const filePath = await downloadFile(requestContext, urlToDownload!, configMapper.workingDir, bridgeJobDef.sourcePath);
      if (filePath) {
        bridgeJobDef.sourcePath = filePath;
      }
    } catch (error) {
      throw new Error("Error in downloading source file");
    }
  }
  Logger.logInfo(
    "iModelBridgeFwk Wrapper",
    `[iModelBridgeService.NodeJsWrapper]: Path to bridge source: ${configMapper.frameworkExePath}`
  );
  Logger.logInfo(
    "iModelBridgeFwk Wrapper",
    `[iModelBridgeService.NodeJsWrapper]: Environment code for iModelJs packages: ${process.env.imjs_buddi_resolve_url_using_region}`
  );
  Logger.logInfo(
    "iModelBridgeFwk Wrapper",
    `[iModelBridgeService.NodeJsWrapper]: iModelHub url: ${process.env["ImodelHubApi.URL"]}`
  );
  Logger.logInfo(
    "iModelBridgeFwk Wrapper",
    `[iModelBridgeService.NodeJsWrapper]: Values passed to BridgeRunner:`
  );
  Logger.logInfo(
    "iModelBridgeFwk Wrapper",
    `[iModelBridgeService.NodeJsWrapper]: ContextId: ${serverArgs.contextId} iModelId: ${serverArgs.iModelId} DMS Server URL: ${bridgeJobDef.dmsServerUrl} Source Path: ${bridgeJobDef.sourcePath} DocumentGuid: ${bridgeJobDef.documentGuid}`
  );
  const fwk = new BridgeRunner(bridgeJobDef, serverArgs);
  const status = await fwk.synchronize();
  Logger.logInfo("iModelBridgeFwk Wrapper", `[iModelBridgeService.NodeJsWrapper]:Node Bridge finished, Status:${  status}`);

  if (status === BentleyStatus.ERROR) {
    throw new Error(`Synchronize failed with status ${status}`);
  }
}

async function getDownloadableUrl(requestContext: AuthorizedClientRequestContext, dmsType: string, inputUrl: string, projectId: string): Promise<string | undefined> {
  if (dmsType === "3") {
    return inputUrl;
  } else if (dmsType === "2") {

    // find the fileId from inputUrl -- last guid in the inputUrl is the fileId
    const guidsInUrl = inputUrl.split("/");
    if (guidsInUrl.length > 0) {
      const fileWsgId = guidsInUrl[guidsInUrl.length - 1];
      const pshare: ProjectShareClient = new ProjectShareClient();
      const files = await pshare.getFiles(
        requestContext,
        projectId,
        new ProjectShareFileQuery().byWsgIds(fileWsgId)
      );
      if (files.length === 1) return files[0].accessUrl;
    }
  } else {
  }

  return undefined;
}

async function downloadFile(
  requestContext: AuthorizedClientRequestContext,
  sasUrl: string,
  workDir: string,
  fileName: string
): Promise<string | undefined> {
  if (!sasUrl) return undefined;

  let filePath = "";
  workDir = workDir.replace(/\\/g, "/");
  if (workDir.endsWith("/")) {
    filePath = workDir + fileName;
  } else {
    filePath = `${workDir} + / + ${fileName}`;
  }

  try {
    const urlHandler = new UrlFileHandler();
    await urlHandler.downloadFile(requestContext, sasUrl, filePath);
  } catch (error) {
    return undefined;
  }

  return filePath;
}

initOperations()
  .then(() => {

    let token = "";
    configMapper.imodelServiceToken()
      .then((_value) => {
        token = _value;
      })
      .catch((_err) => {
        Logger.logError("iModelBridgeFwk Wrapper", _err);
      });
    IModelHelper.releaseSchemaLockForCurrentBriefcase(token, configMapper); // This call verifies that all locks are released for this specific iModel, in this case they should already be but double checking
  })
  .catch((err) => {
    let token = "";
    configMapper.imodelServiceToken()
      .then((_value) => {
        token = _value;
      })
      .catch((_err) => {
        Logger.logError("iModelBridgeFwk Wrapper", _err);
      });

    IModelHelper.releaseAllIModelHubLocksForCurrentBriefcase(token, configMapper); // This call releases locks in the event of a connector failure
    Logger.logError(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: Failed with error- ${err}`,
    );
    process.exit(1);
  });
