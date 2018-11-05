/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64String, Id64 } from "@bentley/bentleyjs-core";

export const createRandomId = (): Id64String => {
  return Id64.fromLocalAndBriefcaseIds(faker.random.number(), faker.random.number());
};

export const createRandomRgbColor = () => {
  return `rgb(
    ${faker.random.number({ max: 255 })},
    ${faker.random.number({ max: 255 })},
    ${faker.random.number({ max: 255 })}
  )`;
};

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
