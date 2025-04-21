/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { RulesetVariableJSON } from "./RulesetVariables.js";

/** @internal */
export const PRESENTATION_IPC_CHANNEL_NAME = "itwinjs-presentation/ipc-interface";

interface CommonIpcParams {
  clientId: string;
}

interface SetRulesetVariableParams<TVariable> extends CommonIpcParams {
  rulesetId: string;
  variable: TVariable;
}

interface UnsetRulesetVariableParams extends CommonIpcParams {
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

/** @internal */
export enum PresentationIpcEvents {
  /**
   * ID of an event that's emitted when backend detects changes in presented data.
   */
  Update = "presentation.onUpdate",
}
