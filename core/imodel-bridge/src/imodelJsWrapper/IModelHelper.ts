/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProductSettingService } from "./ProductSettingsService";
import { Logger } from "@bentley/bentleyjs-core";
import { ConfigMapper } from "./ConfigMapper";

export class IModelHelper {
  public static releaseAllIModelHubLocksForCurrentBriefcase(token: string, configMapper: ConfigMapper) {
    Logger.logInfo(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseAllIModelHubLocksForCurrentBriefcase--Attempting lock release`
    );
    // If briefcase Id is not defined then try to release the lock through imodel id & document id and project id.
    if (configMapper.imodelId === undefined || configMapper.documentGuid === undefined || configMapper.contextId === undefined) {
      Logger.logError(
        "iModelBridgeFwk Wrapper",
        `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseAllIModelHubLocksForCurrentBriefcase--Fail to release lock ImodelId:${configMapper.imodelId} or documentGuid ${configMapper.documentGuid} or ContextId ${configMapper.contextId}`
      );
    } else {
      const imodelId = configMapper.imodelId;
      const contextId = configMapper.contextId;
      const documentId = configMapper.documentGuid;
      ProductSettingService.releaseLockByDocument({ token, imodelId, documentId, contextId })
        .then((value) => {
          Logger.logInfo("iModelBridgeFwk Wrapper", `Released: ${value}`);
        })
        .catch((err) => {
          Logger.logInfo("iModelBridgeFwk Wrapper", `Released: ${err}`);
        });
    }
  }

  public static releaseSchemaLockForCurrentBriefcase(token: string, configMapper: ConfigMapper) {
    if (configMapper.imodelId === undefined || configMapper.documentGuid === undefined || configMapper.contextId === undefined) {
      Logger.logError(
        "iModelBridgeFwk Wrapper",
        `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseSchemaLockForCurrentBriefcase--Fail to release lock ImodelId:${configMapper.imodelId} or documentGuid ${configMapper.documentGuid} or ContextId ${configMapper.contextId}`
      );
    } else {
      const imodelId = configMapper.imodelId;
      const contextId = configMapper.contextId;
      const documentId = configMapper.documentGuid;
      ProductSettingService.releaseSchemaLockByDocument({ token, imodelId, documentId, contextId })
        .then((value) => {
          Logger.logInfo("iModelBridgeFwk Wrapper", `Released: ${value}`);
        })
        .catch((err) => {
          Logger.logInfo("iModelBridgeFwk Wrapper", `Released: ${err}`);
        });
    }
  }
}
