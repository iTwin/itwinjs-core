/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64, Id64String } from "@itwin/core-bentley";

/**
 * @internal Used for testing only.
 */
export const createRandomId = (): Id64String => {
  return Id64.fromLocalAndBriefcaseIds(faker.random.number(), faker.random.number());
};

export function nullable<T>(generator: () => T): T | undefined {
  if (faker.random.boolean()) {
    return undefined;
  }
  return generator();
}
