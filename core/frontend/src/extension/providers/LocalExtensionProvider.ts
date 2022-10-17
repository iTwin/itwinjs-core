/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ExtensionManifest, ExtensionProvider, ResolveFunc } from "../Extension";

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
 * Implements a "local" extension via LocalExtensionProps.
 * An extension is not loaded until it is added to the ExtensionAdmin.
 * The execute() and getManifest() methods are used by the ExtensionAdmin.
 * @alpha
 */
export class LocalExtensionProvider implements ExtensionProvider {
  constructor(private readonly _props: LocalExtensionProviderProps) {}

  /** returns the manifest (package.json) of a local extension */
  public async getManifest(): Promise<ExtensionManifest> {
    return this._props.manifestPromise;
  }

  /** executes the javascript main file / bundle (index.js) of a local extension */
  public async execute(): Promise<any> {
    return this._props.main();
  }
}
