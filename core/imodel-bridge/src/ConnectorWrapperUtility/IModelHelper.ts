/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProductSettingService } from "./ProductSettingsService";
import { Logger } from "@bentley/bentleyjs-core";
import { ConfigMapper } from "./ConfigMapper";

export class IModelHelper {
  public static isRequiredReleaseLock(code: number | null): boolean {
    // 3221225477 Crashed
    // 3221225495 Not Enough Virtual Memory
    // 3221226505 Bufferoverflow
    const errorCodes: number[] = [3221225477, 3221225495, 3221226505];
    if (code === null) {
      return false;
    }
    if (errorCodes.includes(code)) {
      return true;
    }
    return false;
  }

  public static releaseAllIModelHubLocksForCurrentBriefcase(token: string, configMapper: ConfigMapper) {
    // console.log("Attempting lock release");
    Logger.logInfo(
      "iModelBridgeFwk Wrapper",
      `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseAllIModelHubLocksForCurrentBriefcase--Attempting lock release`
    );
    // If briefcase Id is not defined then try to release the lock through imodel id & document id and project id.
    if (configMapper.briefCaseId === undefined) {
      // console.log("attempting lock release non briefcase Id workflow");
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
            Logger.logInfo("IModelHelper", `Schema lock release finished with value: ${value}`);
          })
          .catch((err) => {
            Logger.logError("IModelHelper", `Schema lock release failed, caught error ${err}`);
          });
      } // If briefcase Id is  defined then try to release the lock through briefcase.
    } else {
      // console.log("attempting lock release briefcase Id workflow");
      if (configMapper.imodelId === undefined) {
        Logger.logError(
          "iModelBridgeFwk Wrapper",
          `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseAllIModelHubLocksForCurrentBriefcase--Fail to release lock imodelId is not valid.`
        );
      } else {
        ProductSettingService.releaseLockByIModelBriefCase(token, configMapper.imodelId, configMapper.briefCaseId)
          .then((value) => {
            Logger.logInfo("IModelHelper", `Schema lock release finished with value: ${value}`);
          })
          .catch((err) => {
            Logger.logError("IModelHelper", `Schema lock release failed, caught error ${err}`);
          });
      }
    }
  }

  public static releaseSchemaLockForCurrentBriefcase(token: string, configMapper: ConfigMapper) {
    // console.log("Attempting ReleaseSchemaLock");

    if (configMapper.briefCaseId !== undefined) {
      ProductSettingService.releaseSchemaLockByIModelBriefCase(token, configMapper.imodelId!, configMapper.briefCaseId)
        .then((value) => {
          Logger.logInfo("IModelHelper", `Schema lock release finished with value: ${value}`);
        })
        .catch((err) => {
          Logger.logError("IModelHelper", `Schema lock release failed, caught error ${err}`);
        });
    } else {
      if (configMapper.imodelId === undefined || configMapper.documentGuid === undefined || configMapper.contextId === undefined) {
        Logger.logError(
          "iModelBridgeFwk Wrapper",
          `[iModelBridgeService.NodeJsWrapper]: IModelHelper:releaseSchemaLockForCurrentBriefcase--Fail to release lock ImodelId:${configMapper.imodelId} or documentGuid ${configMapper.documentGuid} or ContextId ${configMapper.contextId}`
        );
      } else {
        const imodelId = configMapper.imodelId;
        const contextId = configMapper.contextId;
        const documentId = configMapper.documentGuid;
        // console.log(`Attempting ReleaseSchemaLock : With Params ${JSON.stringify({ imodelId, documentId, contextId })}`);
        // console.log(
        //   "**Errors in the logs do not indicate an actual errors in releasing the schema locks, rather error indicates that there is no pending locks."
        // );
        ProductSettingService.releaseSchemaLockByDocument({ token, imodelId, documentId, contextId })
          .then((value) => {
            Logger.logInfo("IModelHelper", `Schema lock release finished with value: ${value}`);
          })
          .catch((err) => {
            Logger.logError("IModelHelper", `Schema lock release failed, caught error ${err}`);
          });
      }
    }
  }
}
