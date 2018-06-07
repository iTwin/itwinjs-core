/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64 } from "@bentley/bentleyjs-core";

export const createRandomId = (): Id64 => {
  return new Id64([faker.random.number(), faker.random.number()]);
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
