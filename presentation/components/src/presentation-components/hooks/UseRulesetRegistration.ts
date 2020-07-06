/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { useCallback } from "react";
import { Ruleset } from "@bentley/presentation-common";
import { useDisposable } from "@bentley/ui-core";
import { RulesetRegistrationHelper } from "../common/RulesetRegistrationHelper";

/**
 * Custom hook which registers supplied Ruleset on mount and removes on unmount.
 * @public
 */
export function useRulesetRegistration(ruleset: Ruleset) {
  useDisposable(useCallback(() => new RulesetRegistrationHelper(ruleset), [ruleset]));
}
