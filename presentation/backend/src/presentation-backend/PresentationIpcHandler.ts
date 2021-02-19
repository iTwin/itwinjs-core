/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { IpcHandler } from "@bentley/imodeljs-backend";
import { presentationIpcChannel, PresentationIpcInterface, RulesetVariableJSON, SetRulesetVariableParams } from "@bentley/presentation-common";
import { Presentation } from "./Presentation";

/** @internal */
export class PresentationIpcHandler extends IpcHandler implements PresentationIpcInterface {
  public channelName = presentationIpcChannel;

  public async setRulesetVariable(params: SetRulesetVariableParams<RulesetVariableJSON>): Promise<void> {
    const { variable } = params;
    Presentation.getManager(params.clientId).vars(params.rulesetId).setValue(variable.id, variable.type, variable.value);
  }
}
