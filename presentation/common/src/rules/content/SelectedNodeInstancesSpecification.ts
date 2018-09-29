/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentSpecificationBase } from "./ContentSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";

/**
 * Returns content for current selection.
 *
 * **Note:** No data is returned for selected custom nodes.
 */
export interface SelectedNodeInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.SelectedNodeInstances;

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
   *
   * @pattern ^[\w\d]+$
   */
  acceptableClassNames?: string;

  /**
   * Should [[acceptableClassNames]] property be checked polymorphically. If true, all derived
   * classes are accepted as well.
   */
  acceptablePolymorphically?: boolean;

  /**
   * Identifies whether we should ignore this specification if there is already existing specification
   * with higher `priority` that already provides content.
   */
  onlyIfNotHandled?: boolean;
}
