/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, ChildNodeSpecificationTypes } from "./ChildNodeSpecification";

/**
 * Creates a custom-defined node.
 * @public
 */
export interface CustomNodeSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.CustomNode;

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
