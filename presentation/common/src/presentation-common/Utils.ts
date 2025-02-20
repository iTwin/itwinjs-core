/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { NodeKey } from "./hierarchy/Key";
import { KeySet } from "./KeySet";

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

/**
 * Removes all `undefined` properties from given `obj` object and returns
 * the same (mutated) object.
 *
 * Example: `omitUndefined({ a: 1, b: undefined })` will return `{ a: 1 }`
 *
 * @internal
 */
export function omitUndefined<T extends object>(obj: T): T {
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined) {
      delete obj[key as keyof T];
    }
  });
  return obj;
}

/** @internal */
type NullToUndefined<T> = T extends null
  ? undefined
  : T extends Array<infer U>
    ? Array<NullToUndefined<U>>
    : T extends object
      ? { [K in keyof T]: NullToUndefined<T[K]> }
      : T;

/** @internal */
export function deepReplaceNullsToUndefined<T>(obj: T): NullToUndefined<T> {
  /* istanbul ignore next */
  if (obj === null) {
    return undefined as any;
  }
  /* istanbul ignore next */
  if (Array.isArray(obj)) {
    return obj.map(deepReplaceNullsToUndefined) as NullToUndefined<T>;
  }
  if (typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key as keyof T];
      /* istanbul ignore else */
      if (value !== null && value !== undefined) {
        acc[key as keyof NullToUndefined<T>] = deepReplaceNullsToUndefined(value) as any;
      }
      return acc;
    }, {} as NullToUndefined<T>);
  }
  return obj as any;
}

/** @internal */
export function createCancellableTimeoutPromise(timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout>;
  let rejectPromise: () => void;
  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    timeout = setTimeout(resolve, timeoutMs);
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timeout);
      rejectPromise();
    },
  };
}
