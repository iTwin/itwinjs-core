/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { EntityProps } from "@bentley/imodeljs-common";
import { createRandomId } from "./Misc";

export const createRandomEntityProps = (): EntityProps => {
  return {
    classFullName: faker.random.word(),
    id: createRandomId(),
  };
};
