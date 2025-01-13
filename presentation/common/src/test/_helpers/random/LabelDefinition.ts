/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { LabelCompositeValue, LabelDefinition } from "../../../presentation-common/LabelDefinition";

/**
 * @internal Used for testing only.
 */
export const createRandomLabelDefinition = (): LabelDefinition => {
  return {
    displayValue: faker.random.word(),
    rawValue: faker.random.word(),
    typeName: "string",
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomLabelCompositeValue = (): LabelCompositeValue => {
  return {
    separator: faker.random.alphaNumeric(1),
    values: [createRandomLabelDefinition(), createRandomLabelDefinition()],
  };
};
