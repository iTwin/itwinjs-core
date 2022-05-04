/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

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
 * A "ready to use" Extension (contains a manifest object).
 * Will be used as the type for in-memory extensions in the ExtensionAdmin
 * @alpha
 */
export interface InstalledExtension {
  provider: ExtensionProvider;
  manifest: ExtensionManifest;
}

/**
 * An Extension Provider defines how to fetch and execute an extension.
 * An extension can be one of three kinds:
 *   1. A locally installed extension.
 *   2. A remote extension served from a user provided host.
 *   3. A remote extension served from Bentley's Extension Service.
 * All three must have these required properties and methods.
 * @alpha
 */
export interface ExtensionProvider {
  /** A function that returns the extension's manifest file */
  getManifest: ResolveManifestFunc;
  /** A function that executes the main entry point of the extension */
  execute: ResolveFunc;
  /** Hostname of a remote extension */
  readonly hostname?: string;
}

/**
 * Required props for a local extension provider
 * @alpha
 */
export interface LocalExtensionProviderProps {
  /** A promise that returns the manifest (package.json) of a local extension */
  manifestPromise: Promise<any>;
  /** A function that runs the main entry point of the local extension */
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
 * Required props for an extension uploaded to Bentley's Extension Service
 * @alpha
 */
export interface ServiceExtensionProviderProps {
  /** Name of the uploaded extension */
  name: string;
  /** Version number (Semantic Versioning) */
  version: string;
  /** Context Id */
  contextId: string;
}

/** Structure of extensions from the ExtensionService
 * @internal
 */
export interface ExtensionProps {
  contextId: string;
  extensionName: string;
  version: string;
  files: FileInfo[];
  uploadedBy: string;
  timestamp: Date;
  status: ExtensionUploadStatus;
  isPublic: boolean;
}

interface ExtensionUploadStatus {
  updateTime: Date;
  status: string;
}

interface FileInfo {
  url: string;
  expires: Date;
  checksum: string;
}
