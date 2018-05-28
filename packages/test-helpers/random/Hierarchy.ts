/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as h from "@common/hierarchy";
import { nullable, createRandomHexColor, createRandomRgbColor } from "./Misc";
import { createRandomECInstanceKey } from "./EC";

export const createRandomECInstanceNodeKey = (): h.ECInstanceNodeKey => {
  return {
    type: "ECInstanceNode",
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
    instanceKey: createRandomECInstanceKey(),
  } as h.ECInstanceNodeKey;
};

export const createRandomECInstanceNode = (): h.Node => {
  return {
    key: createRandomECInstanceNodeKey(),
    label: faker.random.words(),
    description: nullable<string>(faker.lorem.sentence),
    foreColor: nullable<string>(createRandomHexColor),
    backColor: nullable<string>(createRandomRgbColor),
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
