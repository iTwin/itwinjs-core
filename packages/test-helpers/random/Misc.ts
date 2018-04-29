/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64 } from "@bentley/bentleyjs-core";

export const createRandomId = (): Id64 => {
  return new Id64([faker.random.number(), faker.random.number()]);
};

export function nullable<T>(generator: () => T): T | undefined {
  if (faker.random.boolean())
    return undefined;
  return generator();
}
