/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { TreeNodeItem } from "@bentley/ui-components";
import * as h from "@bentley/ecpresentation-common/lib/Hierarchy";
import { createRandomECInstanceNodeKey } from "@helpers/random";

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
