/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import deepEqual from "deep-equal";
import * as sinon from "sinon";
import { Keys, KeySet } from "../../presentation-common.js";

/**
 * @internal Used for testing only. sinon matcher for KeySet
 */
export const isKeySet = (expectedKeys: Keys) => {
  const expected = new KeySet(expectedKeys);
  return sinon.match((actual: KeySet) => actual.size === expected.size && actual.hasAll(expected));
};

/**
 * @internal Used for testing only. sinon matcher for deep equality
 */
export const deepEquals = <T>(expected: T) => {
  return sinon.match((actual: T) => deepEqual(actual, expected));
};
