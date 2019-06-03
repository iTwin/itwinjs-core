/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { KeySet } from "./KeySet";
import { NodeKey } from "./hierarchy/Key";

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
 * A dictionary data structure.
 * @public
 */
export interface ValuesDictionary<T> {
  [key: string]: T;
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
    if (NodeKey.isInstanceNodeKey(key)) {
      count++;
    } else if (NodeKey.isGroupingNodeKey(key)) {
      count += key.groupedInstancesCount;
    }
  });
  return count;
};
