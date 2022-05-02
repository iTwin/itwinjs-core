/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import type {
  LocalExtensionProvider,
  RemoteExtensionProvider,
  ServiceExtensionProvider,
} from "./providers";

/**
 * @internal
 */
export const loggerCategory = "imodeljs-frontend.Extension";

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
 * @alpha
 */
export type ExtensionProvider = LocalExtensionProvider | RemoteExtensionProvider | ServiceExtensionProvider;

/**
 * A "ready to use" Extension (contains a manifest object).
 * Will be used as the type for in-memory extensions in the ExtensionAdmin
 * @alpha
 */
export interface InstalledExtension {
  provider: ExtensionProvider;
  manifest: ExtensionManifest;
}

/**
 * Required methods and properties of an ExtensionProvider.
 * @alpha
 */
export interface ExtensionProviderInterface {
  /** A function that returns the extension's manifest file */
  getManifest: ResolveManifestFunc;
  /** A function that executes the main entry point of the extension */
  execute: ResolveFunc;
}

/**
 * Required props for a local extension provider
 * @alpha
 */
export interface LocalExtensionProviderProps {
  manifestPromise: Promise<any>;
  /** runs the main entry point of the extension */
  main: ResolveFunc;
}

/**
 * Required props for a remote extension provider
 * @alpha
 */
export interface RemoteExtensionProviderProps {
  /** URL where the extension entry point can be loaded from */
  jsUrl: string;
  /** URL where the manifest (package.json) can be loaded from */
  manifestUrl: string;
}

/**
 * Required props for a service extension provider
 * @alpha
 */
export interface ServiceExtensionProviderProps {
  /** */
  name: string;
  /** */
  version: string;
  /**  */
  contextId: string;
}
