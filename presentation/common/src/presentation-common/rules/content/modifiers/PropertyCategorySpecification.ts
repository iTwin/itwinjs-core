/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { CustomRendererSpecification } from "./CustomRendererSpecification";

/**
 * Identifier for no category. Used to make category displayed at root level by using
 * this identifier for [[PropertyCategorySpecification.parentId]].
 *
 * @public
 */
export interface NoCategoryIdentifier {
  /** Type of the identifier */
  type: "None";
}

/**
 * Identifier of the default parent category.
 *
 * For direct properties it's the default category. See [[DefaultPropertyCategoryOverride]] for overriding the default category.
 *
 * For related properties it's the category made up from the related ECClass defined by the **last**
 * [[RelatedPropertiesSpecification]] with [[RelationshipMeaning.RelatedInstance]]. If there's no such specification,
 * the default category is used.
 *
 * @public
 */
export interface ParentCategoryIdentifier {
  /** Type of the identifier */
  type: "DefaultParent";
}

/**
 * Identifier of the root category.
 *
 * For direct properties it's the default category. See [[DefaultPropertyCategoryOverride]] for overriding the default category.
 *
 * For related properties it's the category made up from the related ECClass defined by the **first**
 * [[RelatedPropertiesSpecification]] with [[RelationshipMeaning.RelatedInstance]]. If there's no such specification,
 * the default category is used.
 *
 * @public
 */
export interface RootCategoryIdentifier {
  /** Type of the identifier */
  type: "Root";
}

/**
 * Identifier of a category specified through [[PropertyCategorySpecification]] in this scope.
 * @public
 */
export interface IdCategoryIdentifier {
  /** Type of the identifier */
  type: "Id";

  /** ID of the category pointed to by this identifier */
  categoryId: string;

  /** Controls whether a class category should be included under the category pointed to by this identifier */
  createClassCategory?: boolean;
}

/**
 * Category identifier used to assign properties to a category.
 * @public
 */
export type CategoryIdentifier = ParentCategoryIdentifier | RootCategoryIdentifier | IdCategoryIdentifier;

/**
 * Content modifier for defining custom property categories. Custom categories are not present in the result unless
 * they contain at least one property. One way to assign a property to the category is by using
 * [property overrides]($docs/presentation/content/PropertySpecification.md).
 *
 * @see [Property category specification reference documentation page]($docs/presentation/content/PropertyCategorySpecification.md)
 * @public
 */
export interface PropertyCategorySpecification {
  /**
   * Category identifier used to reference the category definition from property overrides or other category
   * definitions. The identifier has to be unique within the list of category definitions where this
   * specification is used.
   */
  id: string;

  /**
   * Identifier of a parent category. When specifying the parent category by ID, it has to be available in
   * the scope of this category definition.
   */
  parentId?: string | CategoryIdentifier | NoCategoryIdentifier;

  /** Display label of the category. May be [localized]($docs/presentation/advanced/Localization.md). */
  label: string;

  /**
   * Extensive description of the category. The description is assigned to the category object that's set
   * on content fields and it's up to UI component to decide how the description is displayed.
   */
  description?: string;

  /**
   * Assign a custom [[CategoryDescription.priority]] to the category. It's up to the
   * UI component to make sure that priority is respected - categories with higher priority should appear
   * before or above categories with lower priority.
   *
   * @type integer
   */
  priority?: number;

  /**
   * Controls the value of [[CategoryDescription.expand]] which tells the UI component
   * displaying the category to auto-expand the category.
   */
  autoExpand?: boolean;

  /**
   * Custom category [renderer specification]($docs/presentation/content/RendererSpecification.md) that allows
   * assigning a custom category renderer to be used in UI. This specification is used to set up
   * [[CategoryDescription.renderer]] for this category and it's up to the UI component to
   * make sure appropriate renderer is used to render the category.
   */
  renderer?: CustomRendererSpecification;
}
