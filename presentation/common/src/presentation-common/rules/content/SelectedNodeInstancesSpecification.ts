/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ContentSpecificationBase, ContentSpecificationTypes } from "./ContentSpecification";

/**
 * Creates content for current selection.
 *
 * **Note:** No data is returned for selected custom nodes.
 *
 * @see [More details]($docs/presentation/Content/SelectedNodeInstances.md)
 * @public
 */
export interface SelectedNodeInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: ContentSpecificationTypes.SelectedNodeInstances;

  /**
   * Filter selected nodes by specified schema name. All schemas are
   * accepted if not specified.
   *
   * @pattern ^[\w\d]+$
   */
  acceptableSchemaName?: string;

  /**
   * Filter selected nodes by specified class names. All classes are
   * accepted if not specified.
   */
  acceptableClassNames?: string[];

  /**
   * Should [[acceptableClassNames]] property be checked polymorphically. If true, all derived
   * classes are accepted as well.
   */
  acceptablePolymorphically?: boolean;
}
