/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { createRandomECInstanceNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { NodeKey } from "@bentley/presentation-common";

export const createRandomTreeNodeItem = (key?: NodeKey, parentId?: string): DelayLoadedTreeNodeItem => {
  return {
    id: faker.random.uuid(),
    parentId,
    label: faker.random.word(),
    description: faker.random.words(),
    hasChildren: faker.random.boolean(),
    extendedData: {
      key: key ? key : createRandomECInstanceNodeKey(),
    },
  };
};
