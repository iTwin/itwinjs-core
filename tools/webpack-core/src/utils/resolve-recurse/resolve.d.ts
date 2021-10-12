/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export = resolveRecurse;
declare function resolveRecurse(options?: ResolveOptions): Promise<Dependency>;
export interface Dependency {
  name: string;
  path: string;
  allowedVersion: string;
  actualVersion: string;
  dependencies: Dependency[];
}
export interface ResolveOptions {
  properties?: string[]; // properties to look for dependencies in
  path?: string; // Path to an npm module to start searching for dependencies
  relative?: string; // Path to the file that path should be resolved relative to.
  filter?: (pkg: any) => boolean; // Determine whether or not to resolve a dependency.
}

