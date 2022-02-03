/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as path from "path";
import { NodeKey } from "./hierarchy/Key";
import type { KeySet } from "./KeySet";

/**
 * Create a type with `T` properties excluding properties listed in `K`.
 *
 * Usage example: `Omit<SomeType, "exclude_prop1" | "exclude_prop2">`
 *
 * @public
 */
export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

/**
 * Create a type with `T` properties excluding all properties in type `K`.
 *
 * Usage example: `Subtract<SomeType, ExcludePropertiesInThisType>`
 *
 * @public
 */
export type Subtract<T, K> = Omit<T, keyof K>;

/**
 * Create a type from given type `T` and make specified properties optional.
 * @public
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * A dictionary data structure.
 * @public
 */
export interface ValuesDictionary<T> {
  [key: string]: T;
}

/**
 * A structure for paged responses
 * @public
 */
export interface PagedResponse<T> {
  /** Total number of items */
  total: number;
  /** Items for the requested page  */
  items: T[];
}

/**
 * Get total number of instances included in the supplied key set. The
 * count is calculated by adding all of the following:
 * - `keys.instanceKeysCount`
 * - number of `keys.nodeKeys` which are *ECInstance* keys
 * - for every grouping node key in `keys.nodeKeys`, number of grouped instances
 *
 * E.g. if `keys` contains one instance key, one *ECInstance* node key
 * and one grouping node key which groups 3 instances, the result is 5.
 *
 * @public
 */
export const getInstancesCount = (keys: Readonly<KeySet>): number => {
  let count = keys.instanceKeysCount;
  keys.nodeKeys.forEach((key: NodeKey) => {
    if (NodeKey.isInstancesNodeKey(key)) {
      count += key.instanceKeys.length;
    } else if (NodeKey.isGroupingNodeKey(key)) {
      count += key.groupedInstancesCount;
    }
  });
  return count;
};

/**
 * Default (recommended) keyset batch size for cases when it needs to be sent
 * over HTTP. Sending keys in batches helps avoid HTTP413 error.
 *
 * @public
 */
export const DEFAULT_KEYS_BATCH_SIZE = 5000;

/** @internal */
export const PRESENTATION_COMMON_ROOT = __dirname;

/** @internal */
// istanbul ignore next
export const getLocalesDirectory = (assetsDirectory: string) => path.join(assetsDirectory, "locales");
