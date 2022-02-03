/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import type { SelectionScope } from "../../../presentation-common";
import { nullable } from "./Misc";

/**
 * @internal Used for testing only.
 */
export const createRandomSelectionScope = (): SelectionScope => ({
  id: faker.random.uuid(),
  label: faker.random.word(),
  description: nullable(() => faker.random.words()),
});
