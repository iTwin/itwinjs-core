/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { CustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/**
 * A label override rule that's applied to all instances of specific ECClass.
 * **Important:** Prefer this rule over [[LabelOverride]] when possible as it works
 * much faster.
 */
export interface InstanceLabelOverride extends CustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.InstanceLabelOverride;

  /** Full name of the ECClass to apply this rule to  */
  className?: string;

  /**
   * List of properties which should be used as instance label. The
   * first property that's set is used as a label.
   */
  properties?: string[];
}
