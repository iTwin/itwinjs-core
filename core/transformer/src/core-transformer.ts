/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export * from "./TransformerLoggerCategory";
export * from "./IModelExporter";
export * from "./IModelImporter";
export * from "./IModelTransformer";

/** @docs-package-description
 * The core-transformer package contains classes that [backend code]($docs/learning/backend/index.md) can use to
 * traverse iModels, as well as *transform* an iModel into another existing or empty one, by exporting elements from one during
 * traversal and importing them into another.
 *
 * You can read further in [iModelTransformation and Data Exchange]($docs/learning/transformer/index.md) here.
 */
/**
 * @docs-group-description iModels
 * Classes for working with [iModels]($docs/learning/iModels.md).
 * See [the learning article]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
/**
 * @docs-group-description Logging
 * Logger categories used by this package.
 */
