/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

/**
 * @alpha
 */
export enum ActivationEvent {
  onStartup = "onStartup",
}

/**
 * @alpha
 */
export type ResolveFunc = () => Promise<any>;

/** Defines the format of an Extension manifest
 * @alpha
*/
export interface ExtensionManifest {
  /** The extension name */
  readonly name: string;
  /** The extension display name */
  readonly displayName?: string;
  /** The extension version */
  readonly version: string;
  /** The extension description */
  readonly description?: string;
  /** The main module file to load. This should be a path to the javascript file
   * e.g "./lib/main.js"
   */
  readonly main: string;
  /** List of activation events this Extension supports. */
  readonly activationEvents: ActivationEvent[];
}

/** @alpha */
export interface BuildExtensionManifest extends ExtensionManifest {
  /** Only valid when the Extension is loaded at build-time.
   *
   * Defines the main ES module that will be imported
   */
  readonly module: string;
}

/** Describes an Extension that has already been downloaded and has a location files can be easily executed.
 * @alpha
*/
export interface LocalExtensionProps {
  readonly manifest: ExtensionManifest;
  readonly mainFunc?: ResolveFunc;
}
