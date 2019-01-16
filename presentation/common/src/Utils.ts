/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import KeySet from "./KeySet";
import { NodeKey, isGroupingNodeKey, isInstanceNodeKey } from "./hierarchy/Key";

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
export type Subtract<T, K> = Omit<T, keyof K>;

/**
 * A dictionary data structure.
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
 * E.g. is `keys` contains one instance key, one *ECInstance* node key
 * and one grouping node key which groups 3 instances, the result is 5.
 */
export const getInstancesCount = (keys: Readonly<KeySet>): number => {
  let count = keys.instanceKeysCount;
  keys.nodeKeys.forEach((key: NodeKey) => {
    if (isInstanceNodeKey(key)) {
      count++;
    } else if (isGroupingNodeKey(key)) {
      count += key.groupedInstancesCount;
    }
  });
  return count;
};
