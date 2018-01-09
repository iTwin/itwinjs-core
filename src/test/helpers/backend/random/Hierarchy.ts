/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as h from "@bentley/ecpresentation-backend/lib/common/Hierarchy";
import { nullable } from "./Misc";

export const createRandomECInstanceNodeKey = (): h.NavNodeKey => {
  return {
    type: "ECInstanceNodeKey",
  };
};

export const createRandomECInstanceNode = (): h.NavNode => {
  return {
    nodeId: Math.floor(faker.random.number(Number.MAX_VALUE)),
    parentNodeId: null,
    key: createRandomECInstanceNodeKey(),
    label: faker.random.words(),
    description: faker.lorem.sentence(),
    imageId: null,
    foreColor: nullable<string>(faker.commerce.color),
    backColor: nullable<string>(faker.commerce.color),
    fontStyle: null,
    type: "ECInstanceNode",
    hasChildren: faker.random.boolean(),
    isSelectable: faker.random.boolean(),
    isEditable: faker.random.boolean(),
    isChecked: faker.random.boolean(),
    isExpanded: faker.random.boolean(),
    isCheckboxVisible: faker.random.boolean(),
    isCheckboxEnabled: faker.random.boolean(),
  };
};

export const createRandomNodePathElement = (depth: number = 1): h.NavNodePathElement => {
  const el: h.NavNodePathElement = {
    node: createRandomECInstanceNode(),
    index: faker.random.number(999),
    isMarked: faker.random.boolean(),
    children: [],
  };
  if (depth > 1) {
    let childrenCount = faker.random.number({ min: 1, max: 5 });
    while (childrenCount--)
      el.children.push(createRandomNodePathElement(depth - 1));
  }
  return el;
};
