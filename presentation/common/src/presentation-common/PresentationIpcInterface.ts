/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { NodeKeyJSON } from "./hierarchy/Key";
import { RulesetVariableJSON } from "./RulesetVariables";

/** @internal */
export const PRESENTATION_IPC_CHANNEL_NAME = "presentation-ipc-interface";

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
export interface UpdateHierarchyStateParams<TNodeKey> extends CommonIpcParams {
  rulesetId: string;
  imodelKey: string;
  changeType: "nodesExpanded" | "nodesCollapsed";
  nodeKeys: Array<TNodeKey>;
}

/** @internal */
export interface PresentationIpcInterface {
  /** Sets ruleset variable value. */
  setRulesetVariable(params: SetRulesetVariableParams<RulesetVariableJSON>): Promise<void>;

  /** Unsets ruleset variable value. */
  unsetRulesetVariable(params: UnsetRulesetVariableParams): Promise<void>;

  /** Updates hierarchy state saved on the backend. Hierarchy state is used when performing updates after iModel data changes */
  updateHierarchyState(params: UpdateHierarchyStateParams<NodeKeyJSON>): Promise<void>;
}
