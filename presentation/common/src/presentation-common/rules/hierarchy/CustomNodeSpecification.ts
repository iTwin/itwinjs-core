/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";

/**
 * Returns a static custom-defined node that's not based on an ECInstance.
 *
 * @see [Custom node specification reference documentation page]($docs/presentation/hierarchies/CustomNode.md)
 * @public
 */
export interface CustomNodeSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "CustomNode";

  /** Specifies node type, which is assigned to node's key. */
  type: string;

  /**
   * Specifies node label. This is a string value that may be [localized]($docs/presentation/advanced/Localization.md).
   */
  label: string;

  /**
   * Specifies the value of [[Node.description]] property, which is a string that may
   * be [localized]($docs/presentation/advanced/Localization.md). UI component displaying the node may choose
   * whether and how to surface this information to users.
   */
  description?: string;

  /**
   * Specifies node's image ID. If set, the ID is assigned to [[Node.imageId]] and it's
   * up to the UI component to decide what to do with it.
   */
  imageId?: string;
}
