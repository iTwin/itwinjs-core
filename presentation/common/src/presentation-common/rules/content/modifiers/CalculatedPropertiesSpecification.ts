/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { CustomRendererSpecification } from "./CustomRendererSpecification";
import { CategoryIdentifier } from "./PropertyCategorySpecification";
import { PropertyEditorSpecification } from "./PropertyEditorsSpecification";

/**
 * This content modifier allows including additional calculated properties into the content.
 *
 * @see [Calculated properties specification reference documentation page]($docs/presentation/content/CalculatedPropertiesSpecification.md)
 * @public
 */
export interface CalculatedPropertiesSpecification {
  /** Specifies label of the calculated property. Supports [localization]($docs/presentation/advanced/Localization.md). */
  label: string;

  /**
   * Defines an expression to calculate the value. The expression can use [ECInstance]($docs/presentation/advanced/ECExpressions.md#ecinstance)
   * and [Ruleset Variables]($docs/presentation/advanced/ECExpressions.md#ruleset-variables-user-settings) symbol contexts.
   */
  value: string;

  /** The attribute allows moving the calculated property into a different category. */
  categoryId?: string | CategoryIdentifier;

  /**
   * Custom property [renderer specification]($docs/presentation/content/RendererSpecification.md) that allows assigning a
   * custom value renderer to be used in UI. The specification is used to set up [[Field.renderer]] for
   * this property and it's up to the UI component to make sure appropriate renderer is used to render the property.
   */
  renderer?: CustomRendererSpecification;

  /**
   * Custom [property editor specification]($docs/presentation/content/PropertyEditorSpecification) that allows assigning
   * a custom value editor to be used in UI.
   */
  editor?: PropertyEditorSpecification;

  /**
   * Assign a custom [[Field.priority]] to the property. It's up to the UI component to make sure that priority
   * is respected - properties with higher priority should appear before or above properties with lower priority.
   *
   * @type integer
   */
  priority?: number;
}
