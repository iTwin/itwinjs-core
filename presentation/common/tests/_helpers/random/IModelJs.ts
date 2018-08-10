/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
