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
}

/**
 * Category identifier used to assign properties to a category.
 * @public
 */
export type CategoryIdentifier = ParentCategoryIdentifier | RootCategoryIdentifier | IdCategoryIdentifier;

/**
 * Specification to define a custom property category.
 *
 * @see [More details]($docs/presentation/Content/PropertyCategorySpecification.md)
 * @public
 */
export interface PropertyCategorySpecification {
  /** Category identifier which has to be unique at the scope of it's definition. */
  id: string;

  /**
   * Identifier of a parent category. When specified as a `string`,
   * the value acts as an [[IdCategoryIdentifier]]. Defaults to [[ParentCategoryIdentifier]].
   */
  parentId?: string | CategoryIdentifier | NoCategoryIdentifier;

  /** Display label of the category. May be [localized]($docs/presentation/Advanced/Localization.md). */
  label: string;

  /** Optional extensive description of the category. */
  description?: string;

  /**
   * Priority of the category. Higher priority categories are displayed on top. Defaults to `1000`.
   * @type integer
   */
  priority?: number;

  /** Should this category be auto-expanded. Defaults to `false`. */
  autoExpand?: boolean;

  /** Custom category renderer specification. */
  renderer?: CustomRendererSpecification;
}
