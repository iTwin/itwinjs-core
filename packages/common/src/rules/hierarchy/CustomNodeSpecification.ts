/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/** Returns a custom-defined node. */
export interface CustomNodeSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.CustomNodeSpecification;

  /** Type of the node. Check against this type in your ECExpression. */
  nodeType?: string;

  /** Label of the node. May be [localized]($docs/learning/Localization.md). */
  label?: string;

  /**
   * Description of the node (used as a tooltip). May be [localized]($docs/learning/Localization.md).
   * Default is set to empty string.
   */
  description?: string;

  /** Id of the image to use for this custom node. */
  imageId?: string;
}
