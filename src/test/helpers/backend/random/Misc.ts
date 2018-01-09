/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";

export function nullable<T>(generator: () => T): T | null {
  if (faker.random.boolean())
    return null;
  return generator();
}
