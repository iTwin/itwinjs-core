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
export type ActivationEvent = "onStartup";

/**
 * @alpha
 */
export type ResolveFunc = () => Promise<any>;

/**
 * @alpha
 */
export type ResolveManifestFunc = () => Promise<ExtensionManifest>;

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
  /** Only valid when the Extension is loaded at build-time.
   *
   * Defines the main ES module that will be imported
   */
  readonly module?: string;
  /** List of activation events this Extension supports. */
  readonly activationEvents: ActivationEvent[];
}

/**
 * An Extension Provider defines how to fetch and execute an extension.
 * An extension can be one of three kinds:
 *   1. A locally installed extension.
 *   2. A remote extension served from a user provided host.
 *   3. A remote extension served from Bentley's Extension Service.
 * All three must have a way to fetch the manifest (package.json) and main entry point files.
 * @alpha
 */
export interface ExtensionProvider {
  /** A function that returns the extension's manifest (package.json) file */
  getManifest: ResolveManifestFunc;
  /** A function that executes the main entry point of the extension */
  execute: ResolveFunc;
  /** Hostname of a remote extension */
  readonly hostname?: string;
}
