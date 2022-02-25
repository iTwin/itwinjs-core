/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { ExtensionManifest, LocalExtensionProps, ResolveFunc } from "./Extension";

/** The minimum information required to download an Extension
 * @alpha
*/
export interface ExtensionLoaderProps {
  name: string;
  version: string;
}

/** @alpha */
export interface BuiltInExtensionLoaderProps {
  manifest: Promise<any>;
  loader: ResolveFunc;
}

/** Describes what is needed in order to write an Extension Loader.
 * @alpha
 */
export interface ExtensionLoader {
  /** Retrieves an Extension manifest for the provided Extension identifier */
  getManifest(arg: ExtensionLoaderProps): Promise<ExtensionManifest>;
  /** Downloads an Extension provided the name of the Extension */
  downloadExtension(arg: ExtensionLoaderProps): Promise<LocalExtensionProps>;
}
