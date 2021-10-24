/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ExtensionManifest, LocalExtensionProps } from "./Extension";

/** THe minimum information required to download an Extension */
export interface ExtensionLoaderProps {
  name: string;
  version: string;
}

export interface BuiltInExtensionLoaderProps {
  manifest: Promise<any>;
  loader: (() => Promise<any>);
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

// export class BuiltInExtensionLoader {
//   public async getManifest(name: string): Promise<ExtensionManifest> {

//   }
// }
