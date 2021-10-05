/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { LabelCompositeValue, LabelCompositeValueJSON, LabelDefinition, LabelDefinitionJSON } from "../../../presentation-common/LabelDefinition";

export const createRandomLabelDefinitionJSON = (): LabelDefinitionJSON => {
  return {
    displayValue: faker.random.word(),
    rawValue: faker.random.word(),
    typeName: "string",
  };
};

export const createRandomLabelDefinition = (): LabelDefinition => {
  return LabelDefinition.fromJSON(createRandomLabelDefinitionJSON());
};

export const createRandomLabelCompositeValue = (): LabelCompositeValue => {
  return {
    separator: faker.random.alphaNumeric(1),
    values: [createRandomLabelDefinition(), createRandomLabelDefinition()],
  };
};

export const createRandomLabelCompositeValueJSON = (): LabelCompositeValueJSON => {
  return {
    separator: faker.random.alphaNumeric(1),
    values: [createRandomLabelDefinitionJSON(), createRandomLabelDefinitionJSON()],
  };
};
