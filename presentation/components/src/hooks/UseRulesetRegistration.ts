/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { useRef, useEffect } from "react";
import { Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

/** Custom hook which registers supplied Ruleset on mount and removes on unmount.
 * @alpha
 */
export function useRulesetRegistration(ruleset: Ruleset) {
  const registeredRuleset = useRef<RegisteredRuleset>();

  useEffect(() => {
    const register = async () => {
      registeredRuleset.current = await Presentation.presentation.rulesets().add(ruleset);
    };

    register(); // tslint:disable-line: no-floating-promises

    return () => {
      // istanbul ignore else
      if (registeredRuleset.current)
        Presentation.presentation.rulesets().remove(registeredRuleset.current); // tslint:disable-line: no-floating-promises
    };
  }, []);
}
