/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Specification for custom content renderer.
 * @public
 */
export interface CustomRendererSpecification {
  /** Name of the custom renderer. */
  rendererName: string;
}

/**
 * Specification for custom property renderer.
 * @public
 * @deprecated Superseded by [[CustomRendererSpecification]].
 */
export type PropertyRendererSpecification = CustomRendererSpecification;
