/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IpcApp } from "@itwin/core-frontend";
import {
  PRESENTATION_IPC_CHANNEL_NAME,
  PresentationIpcInterface,
  RulesetVariable,
  RulesetVariableJSON,
  SetRulesetVariableParams,
  UnsetRulesetVariableParams,
} from "@itwin/presentation-common";

/** @internal */
export class IpcRequestsHandler {
  private _ipcProxy = IpcApp.makeIpcProxy<PresentationIpcInterface>(PRESENTATION_IPC_CHANNEL_NAME);
  public readonly clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  public async setRulesetVariable(params: Omit<SetRulesetVariableParams<RulesetVariable>, "clientId">) {
    const jsonParams: SetRulesetVariableParams<RulesetVariableJSON> = {
      ...params,
      clientId: this.clientId,
      variable: RulesetVariable.toJSON(params.variable),
    };
    return this._ipcProxy.setRulesetVariable(jsonParams);
  }

  public async unsetRulesetVariable(params: Omit<UnsetRulesetVariableParams, "clientId">) {
    const jsonParams: UnsetRulesetVariableParams = {
      ...params,
      clientId: this.clientId,
    };
    return this._ipcProxy.unsetRulesetVariable(jsonParams);
  }
}
