/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AsyncMethodsOf, IpcApp, PromiseReturnType } from "@bentley/imodeljs-frontend";
import { NodeKey, PRESENTATION_IPC_CHANNEL_NAME, PresentationIpcInterface, RulesetVariable, SetRulesetVariableParams, UpdateHierarchyStateParams } from "@bentley/presentation-common";

/** @internal */
export class IpcRequestsHandler {
  public readonly clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  private injectClientId<T>(params: T) {
    return { ...params, clientId: this.clientId };
  }

  private async call<T extends AsyncMethodsOf<PresentationIpcInterface>>(methodName: T, ...args: Parameters<PresentationIpcInterface[T]>): Promise<PromiseReturnType<PresentationIpcInterface[T]>> {
    return IpcApp.callIpcChannel(PRESENTATION_IPC_CHANNEL_NAME, methodName, ...args);
  }

  public async setRulesetVariable(params: Omit<SetRulesetVariableParams<RulesetVariable>, "clientId">) {
    return this.call("setRulesetVariable", this.injectClientId(params));
  }

  public async updateHierarchyState(params: Omit<UpdateHierarchyStateParams<NodeKey>, "clientId">) {
    return this.call("updateHierarchyState", this.injectClientId({ ...params, nodeKeys: params.nodeKeys.map(NodeKey.toJSON) }));
  }
}

