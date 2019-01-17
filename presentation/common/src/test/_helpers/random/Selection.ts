/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { SelectionScope } from "../../../presentation-common";
import { nullable } from "./Misc";

export const createRandomSelectionScope = (): SelectionScope => ({
  id: faker.random.uuid(),
  label: faker.random.word(),
  description: nullable(() => faker.random.words()),
});
