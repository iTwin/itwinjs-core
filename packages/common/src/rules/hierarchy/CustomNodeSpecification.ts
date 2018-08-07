/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";

/** Returns a custom-defined node. */
export interface CustomNodeSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.CustomNode;

  /** Type of the node. */
  type: string;

  /**
   * Label of the node. May be [localized]($docs/learning/Localization.md).
   */
  label: string;

  /**
   * Description of the node. May be [localized]($docs/learning/Localization.md).
   */
  description?: string;

  /** Id of the image to use for this custom node. */
  imageId?: string;
}
