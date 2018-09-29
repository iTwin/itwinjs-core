/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { createRandomECInstanceNodeKey } from "@bentley/presentation-common/tests/_helpers/random";
import { TreeNodeItem } from "@bentley/ui-components";
import * as h from "@bentley/presentation-common/lib/Hierarchy";

export const createRandomTreeNodeItem = (key?: h.NodeKey, parentId?: string): TreeNodeItem => {
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
