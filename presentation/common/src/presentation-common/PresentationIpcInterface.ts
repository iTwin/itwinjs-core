/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { RulesetVariableJSON } from "./RulesetVariables";

/** @internal */
export const PRESENTATION_IPC_CHANNEL_NAME = "itwinjs-presentation/ipc-interface";

/** @internal */
export interface CommonIpcParams {
  clientId: string;
}

/** @internal */
export interface SetRulesetVariableParams<TVariable> extends CommonIpcParams {
  rulesetId: string;
  variable: TVariable;
}

/** @internal */
export interface UnsetRulesetVariableParams extends CommonIpcParams {
  rulesetId: string;
  variableId: string;
}

/** @internal */
export interface PresentationIpcInterface {
  /** Sets ruleset variable value. */
  setRulesetVariable(params: SetRulesetVariableParams<RulesetVariableJSON>): Promise<void>;

  /** Unsets ruleset variable value. */
  unsetRulesetVariable(params: UnsetRulesetVariableParams): Promise<void>;
}
