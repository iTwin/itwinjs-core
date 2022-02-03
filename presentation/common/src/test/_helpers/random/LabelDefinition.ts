/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import type { LabelCompositeValue, LabelCompositeValueJSON, LabelDefinitionJSON } from "../../../presentation-common/LabelDefinition";
import { LabelDefinition } from "../../../presentation-common/LabelDefinition";

/**
 * @internal Used for testing only.
 */
export const createRandomLabelDefinitionJSON = (): LabelDefinitionJSON => {
  return {
    displayValue: faker.random.word(),
    rawValue: faker.random.word(),
    typeName: "string",
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomLabelDefinition = (): LabelDefinition => {
  return LabelDefinition.fromJSON(createRandomLabelDefinitionJSON());
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

/**
 * @internal Used for testing only.
 */
export const createRandomLabelCompositeValueJSON = (): LabelCompositeValueJSON => {
  return {
    separator: faker.random.alphaNumeric(1),
    values: [createRandomLabelDefinitionJSON(), createRandomLabelDefinitionJSON()],
  };
};
