/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Report invalid or unsupported Gaussian splat content. It has a module of its own so that the glTF reader can report such
 * content without loading the Gaussian splat implementation.
 * @internal
 */
export function gaussianSplatError(message: string): never {
  throw new Error(`Gaussian splats: ${message}`);
}
