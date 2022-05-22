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

/**
 * @internal Used for testing only.
 */
export const createRandomRgbColor = () => {
  return `rgb(
    ${faker.random.number({ max: 255 })},
    ${faker.random.number({ max: 255 })},
    ${faker.random.number({ max: 255 })}
  )`;
};

/**
 * @internal Used for testing only.
 */
export const createRandomHexColor = () => {
  const elements = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
  let result = "#";
  let length = 6;
  while (length--)
    result += faker.random.arrayElement(elements);
  return result;
};

export function nullable<T>(generator: () => T): T | undefined {
  if (faker.random.boolean())
    return undefined;
  return generator();
}
