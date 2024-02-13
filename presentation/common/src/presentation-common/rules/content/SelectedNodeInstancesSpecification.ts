/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ContentSpecificationBase } from "./ContentSpecification";

/**
 * Returns content for selected (input) instances.
 *
 * @see [Selected node instances specification reference documentation page]($docs/presentation/content/SelectedNodeInstances.md)
 * @public
 */
export interface SelectedNodeInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: "SelectedNodeInstances";

  /**
   * Specifies ECSchema name which the input instances have to match for the specification to be used.
   *
   * @pattern ^[\w\d]+$
   */
  acceptableSchemaName?: string;

  /**
   * Specifies a list of class names which the input instances have to match for the specification to be used.
   */
  acceptableClassNames?: string[];

  /**
   * Specifies whether derived classes of [[acceptableClassNames]] should be included in the content.
   */
  acceptablePolymorphically?: boolean;
}
