/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { CustomRendererSpecification } from "./modifiers/CustomRendererSpecification";
import { CategoryIdentifier } from "./modifiers/PropertyCategorySpecification";
import { PropertyEditorSpecification } from "./modifiers/PropertyEditorsSpecification";

/**
 * A container structure for possible property overrides
 *
 * @see [Property specification reference documentation page]($docs/presentation/content/PropertySpecification.md)
 * @public
 */
export interface PropertyOverrides {
  /**
   * There may be multiple property specifications that apply to a single property and there may be conflicts between
   * different attributes. The `overridesPriority` attribute is here to help solve the problem - if multiple specifications
   * attempt to override the same attribute, the override of specification with highest `overridesPriority` value is used.
   * The order of overrides from specification with the same `overridesPriority` is defined by the order they appear in
   * the overrides list.
   */
  overridesPriority?: number;

  /** This is an attribute that allows overriding the property label. May be [localized]($docs/presentation/advanced/Localization.md). */
  labelOverride?: string;

  /** The attribute allows moving the property into a different category. */
  categoryId?: string | CategoryIdentifier;

  /**
   * This attribute controls whether the particular property is present in the result, even when it is marked as hidden in the
   * ECSchema. The allowed settings are:
   *
   * - Omitted or `undefined`: property visibility is controlled by the ECSchema.
   *
   * - `true`: property is made visible. **Warning:** this will automatically hide all other properties of the same class.
   *   If this behavior is not desirable, set [[doNotHideOtherPropertiesOnDisplayOverride]] attribute to `true`.
   *
   * - `false`: property is made hidden.
   *
   * The value can also be set using an ECExpression.
   */
  isDisplayed?: boolean | string;

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
   * This attribute controls whether making the property visible using [[isDisplayed]] attribute should automatically hide
   * all other properties of the same class. When `true`, this behavior is disabled.
   */
  doNotHideOtherPropertiesOnDisplayOverride?: boolean;

  /**
   * This attribute controls whether the property field is read-only. If the attribute value is not set, the field is
   * read-only when at least one of the properties is read-only.
   */
  isReadOnly?: boolean;

  /**
   * This attribute controls the order in which property fields should be displayed. Property fields with higher priority
   * will appear before property fields with lower priority. If the attribute value is not set, the field's priority
   * will be the maximum priority of its properties.
   */
  priority?: number;
}

/**
 * This specification allows overriding some attributes of specific ECProperty or define how it's displayed.
 *
 * @see [Property specification reference documentation page]($docs/presentation/content/PropertySpecification.md)
 * @public
 */
export interface PropertySpecification extends PropertyOverrides {
  /**
   * Name of the ECProperty to apply overrides to. A `"*"` may be specified to match all properties in current context.
   * The current context is determined based on where the override is specified:
   *
   * - When used in a [content modifier]($docs/presentation/content/ContentModifier.md#attribute-propertyoverrides), the
   *   properties of the ECClass specified by the [`class` attribute]($docs/presentation/content/ContentModifier.md#attribute-class) are used.
   *
   * - When used in one of the [content specifications]($docs/presentation/content/ContentRule.md#attribute-specifications),
   *   properties produced by that specification are used.
   */
  name: string;
}
