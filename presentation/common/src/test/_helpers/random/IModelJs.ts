/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64 } from "@itwin/core-bentley";
import type { EntityProps } from "@itwin/core-common";
import { createRandomId } from "./Misc";

interface RandomEntityProps extends EntityProps {
  type: string;
}

/**
 * @internal Used for testing only.
 */
export const createRandomEntityProps = (): EntityProps => {
  const props: RandomEntityProps = {
    classFullName: faker.random.word(),
    id: createRandomId(),
    type: faker.random.word(),
  };
  return props;
};

/**
 * @internal Used for testing only.
 */
export const createRandomTransientId = () => Id64.fromLocalAndBriefcaseIds(123, 0xffffff);
