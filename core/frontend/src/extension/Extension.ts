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
 * Methods to provide an extension's content (local function vs remote function)
 * @alpha
 */
type ExtensionContentProvider =
  | {
    /**
       * A local function that is the starting execution point for the Extension.
       * Typically used with locally installed Extensions
       */
    readonly main: ResolveFunc;
    jsUrl?: never;
  }
  | {
    main?: never;
    /**
       * The url for an endpoint that responds with a Javascript file that contains a default function that is the starting execution point for the Extension.
       * Typically used with remote Extensions
       */
    readonly jsUrl: string;
  };

/**
 * A "ready to use" Extension (contains a manifest object).
 * Will be used as the type for in-memory extensions in the ExtensionAdmin
 * @alpha
 */
export type Extension = ExtensionContentProvider & {
  readonly manifest: ExtensionManifest;
};

/**
 * Properties that are required to construct an Extension.
 * Is the parameter type for the "ExtensionAdmin.addExtension" method, which is the preferred method for consumers to provide/register an Extension
 * @alpha
 */
export type ExtensionProvider = ExtensionContentProvider &
(
  | {
    /**
         * A local promise that resolves the manifest.
         * Typically used with locally installed Extensions
         */
    readonly manifestPromise: Promise<ExtensionManifest>;
    manifestUrl?: never;
  }
  | {
    readonly manifestPromise?: never;
    /**
         * The url for an endpoint that responds with the manifest.
         * Typically used with remote Extensions
         */
    manifestUrl: string;
  }
);
