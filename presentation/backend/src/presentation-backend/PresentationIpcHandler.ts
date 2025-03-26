/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RPC
 */

import { IpcHandler } from "@itwin/core-backend";
import { RulesetVariable } from "@itwin/presentation-common";
import { PRESENTATION_IPC_CHANNEL_NAME, PresentationIpcInterface } from "@itwin/presentation-common/internal";
import { Presentation } from "./Presentation.js";

/** @internal */
export class PresentationIpcHandler extends IpcHandler implements PresentationIpcInterface {
  public channelName = PRESENTATION_IPC_CHANNEL_NAME;

  public async setRulesetVariable(params: Parameters<PresentationIpcInterface["setRulesetVariable"]>[0]): Promise<void> {
    const { clientId, rulesetId, variable } = params;
    const parsedVariable = RulesetVariable.fromJSON(variable);
    Presentation.getManager(clientId).vars(rulesetId).setValue(parsedVariable.id, parsedVariable.type, parsedVariable.value);
  }

  public async unsetRulesetVariable(params: Parameters<PresentationIpcInterface["unsetRulesetVariable"]>[0]): Promise<void> {
    const { clientId, rulesetId, variableId } = params;
    Presentation.getManager(clientId).vars(rulesetId).unset(variableId);
  }
}
