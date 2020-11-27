/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { EntityProps } from "@bentley/imodeljs-common";
import { createRandomId } from "./Misc";

interface RandomEntityProps extends EntityProps {
  type: string;
}

export const createRandomEntityProps = (): EntityProps => {
  const props: RandomEntityProps = {
    classFullName: faker.random.word(),
    id: createRandomId(),
    type: faker.random.word(),
  };
  return props;
};

export const createRandomTransientId = (): Id64String => Id64.fromLocalAndBriefcaseIds(123, 0xffffff);
