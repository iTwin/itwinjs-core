/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { Logger } from "@bentley/bentleyjs-core";
import { IModelDb, IpcHandler } from "@bentley/imodeljs-backend";
import { NodeKeyJSON, PRESENTATION_IPC_CHANNEL_NAME, PresentationIpcInterface, RulesetVariableJSON, SetRulesetVariableParams, UpdateHierarchyStateParams } from "@bentley/presentation-common";
import { PresentationBackendLoggerCategory } from "./BackendLoggerCategory";
import { Presentation } from "./Presentation";

/** @internal */
export class PresentationIpcHandler extends IpcHandler implements PresentationIpcInterface {
  public channelName = PRESENTATION_IPC_CHANNEL_NAME;

  public async setRulesetVariable(params: SetRulesetVariableParams<RulesetVariableJSON>): Promise<void> {
    const { clientId, rulesetId, variable } = params;
    Presentation.getManager(clientId).vars(rulesetId).setValue(variable.id, variable.type, variable.value);
  }

  public async updateHierarchyState(params: UpdateHierarchyStateParams<NodeKeyJSON>): Promise<void> {
    const { clientId, imodelKey, rulesetId, changeType, nodeKeys } = params;
    const imodelDb = IModelDb.tryFindByKey(imodelKey);
    if (!imodelDb) {
      Logger.logError(PresentationBackendLoggerCategory.Ipc, "Could not find IModelDb to perform hierarchy state update");

      return;
    }
    Presentation.getManager(clientId).getNativePlatform().updateHierarchyState(imodelDb.nativeDb, rulesetId, changeType, JSON.stringify(nodeKeys));
  }
}
