/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";

export function nullable<T>(generator: () => T): T | undefined {
  if (faker.random.boolean())
    return undefined;
  return generator();
}
