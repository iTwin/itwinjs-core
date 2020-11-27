/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
import { Keys, KeySet } from "../../presentation-common";

export * from "typemoq";
const deepEqual = require("deep-equal"); // eslint-disable-line @typescript-eslint/no-var-requires
/**
 * Should be called if mock.object is used to resolve a Promise. Otherwise
 * typemoq tries to handle 'then' method of the mocked object and the promise
 * never resolves. See https://github.com/florinn/typemoq/issues/70.
 */
export const configureForPromiseResult = <T>(mock: moq.IMock<T>): void => {
  mock.setup((x: any) => x.then).returns(() => undefined);
};

/** typemoq matcher for KeySet */
export const isKeySet = (expectedKeys: Keys): KeySet => {
  const expected = new KeySet(expectedKeys);
  return moq.It.is<KeySet>((actual: KeySet) => (actual.size === expected.size && actual.hasAll(expected)));
};

/** typemoq matcher for deep equality */
export const deepEquals = <T>(expected: T): T => {
  return moq.It.is((actual: T) => deepEqual(actual, expected));
};
