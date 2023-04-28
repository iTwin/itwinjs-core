/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * This specification allows defining a custom renderer, which can be used to render properties or categories.
 *
 * @see [Renderer specification reference documentation page]($docs/presentation/content/RendererSpecification.md)
 * @public
 */
export interface CustomRendererSpecification {
  /**
   * Name of the renderer that's going to be used in UI components. Value of this attribute corresponds
   * to [[RendererDescription.name]] attribute that gets assigned to whatever the renderer
   * is set on.
   */
  rendererName: string;
}
