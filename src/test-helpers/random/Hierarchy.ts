/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as h from "../../common/Hierarchy";
import { nullable, createRandomId } from "./Misc";

export const createRandomECInstanceNodeKey = (): h.NodeKey => {
  return {
    type: "ECInstanceNode",
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
    classId: createRandomId(),
    instanceId: createRandomId(),
  } as h.NodeKey;
};

export const createRandomECInstanceNode = (): h.Node => {
  return {
    nodeId: createRandomId(),
    key: createRandomECInstanceNodeKey(),
    label: faker.random.words(),
    description: faker.lorem.sentence(),
    foreColor: nullable<string>(faker.commerce.color),
    backColor: nullable<string>(faker.commerce.color),
    hasChildren: faker.random.boolean(),
    isSelectable: faker.random.boolean(),
    isEditable: faker.random.boolean(),
    isChecked: faker.random.boolean(),
    isExpanded: faker.random.boolean(),
    isCheckboxVisible: faker.random.boolean(),
    isCheckboxEnabled: faker.random.boolean(),
  };
};

export const createRandomNodePathElement = (depth: number = 1): h.NodePathElement => {
  const el: h.NodePathElement = {
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
