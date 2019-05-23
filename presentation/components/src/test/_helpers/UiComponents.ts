/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as faker from "faker";
import { createRandomECInstanceNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { PropertyRecord, PrimitiveValue, PropertyDescription, PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { NodeKey } from "@bentley/presentation-common";
import { PRESENTATION_TREE_NODE_KEY } from "../../tree/Utils";

export const createRandomTreeNodeItem = (key?: NodeKey, parentId?: string): DelayLoadedTreeNodeItem => {
  const node = {
    id: faker.random.uuid(),
    parentId,
    label: faker.random.word(),
    description: faker.random.words(),
    hasChildren: faker.random.boolean(),
  };
  (node as any)[PRESENTATION_TREE_NODE_KEY] = key ? key : createRandomECInstanceNodeKey();
  return node;
};

export const createRandomPropertyRecord = (): PropertyRecord => {
  const value: PrimitiveValue = {
    valueFormat: PropertyValueFormat.Primitive,
    value: faker.random.word(),
    displayValue: faker.random.words(),
  };
  const descr: PropertyDescription = {
    typename: "string",
    name: faker.random.word(),
    displayLabel: faker.random.word(),
  };
  return new PropertyRecord(value, descr);
};
