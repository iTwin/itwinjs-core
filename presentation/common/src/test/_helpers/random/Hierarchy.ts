/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import {
  BaseNodeKey,
  ECClassGroupingNodeKey,
  ECInstancesNodeKey,
  ECPropertyGroupingNodeKey,
  GroupingNodeKey,
  LabelGroupingNodeKey,
  Node,
  NodePathElement,
  StandardNodeTypes,
} from "../../../presentation-common";
import { InstanceKey } from "../../../presentation-common/EC";
import { createRandomECInstanceKey } from "./EC";
import { createRandomLabelDefinition } from "./LabelDefinition";
import { nullable } from "./Misc";

/**
 * @internal Used for testing only.
 */
export const createRandomBaseNodeKey = (): BaseNodeKey => {
  return {
    type: faker.random.word(),
    version: 2,
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomECInstancesNodeKey = (instanceKeys?: InstanceKey[]): ECInstancesNodeKey => {
  instanceKeys = instanceKeys ?? [createRandomECInstanceKey(), createRandomECInstanceKey()];
  return {
    type: StandardNodeTypes.ECInstancesNode,
    version: 2,
    pathFromRoot: [faker.random.uuid(), faker.random.uuid()],
    instanceKeys,
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomECClassGroupingNodeKey = (groupedInstancesCount?: number): ECClassGroupingNodeKey => ({
  type: StandardNodeTypes.ECClassGroupingNode,
  version: 2,
  pathFromRoot: [faker.random.uuid()],
  className: faker.random.word(),
  groupedInstancesCount: groupedInstancesCount || faker.random.number(),
});

/**
 * @internal Used for testing only.
 */
export const createRandomECPropertyGroupingNodeKey = (groupedInstancesCount?: number): ECPropertyGroupingNodeKey => ({
  type: StandardNodeTypes.ECPropertyGroupingNode,
  version: 2,
  pathFromRoot: [faker.random.uuid()],
  className: faker.random.word(),
  propertyName: faker.random.word(),
  groupingValues: [faker.random.number(), faker.random.number()],
  groupedInstancesCount: groupedInstancesCount || faker.random.number(),
});

/**
 * @internal Used for testing only.
 */
export const createRandomLabelGroupingNodeKey = (groupedInstancesCount?: number): LabelGroupingNodeKey => ({
  type: StandardNodeTypes.DisplayLabelGroupingNode,
  version: 2,
  pathFromRoot: [faker.random.uuid()],
  label: faker.random.words(),
  groupedInstancesCount: groupedInstancesCount || faker.random.number(),
});

/**
 * @internal Used for testing only.
 */
export const createRandomGroupingNodeKey = (groupedInstancesCount?: number): GroupingNodeKey => {
  const type = faker.random.arrayElement([
    StandardNodeTypes.DisplayLabelGroupingNode,
    StandardNodeTypes.ECClassGroupingNode,
    StandardNodeTypes.ECPropertyGroupingNode,
  ]);
  switch (type) {
    case StandardNodeTypes.DisplayLabelGroupingNode:
      return createRandomLabelGroupingNodeKey(groupedInstancesCount);
    case StandardNodeTypes.ECClassGroupingNode:
      return createRandomECClassGroupingNodeKey(groupedInstancesCount);
    case StandardNodeTypes.ECPropertyGroupingNode:
      return createRandomECPropertyGroupingNodeKey(groupedInstancesCount);
  }
  throw Error();
};

/**
 * @internal Used for testing only.
 */
export const createRandomECInstancesNode = (props?: Partial<Node>): Node => {
  return {
    ...props,
    key: props?.key ?? createRandomECInstancesNodeKey(),
    label: props?.label ?? createRandomLabelDefinition(),
    description: props?.description ?? nullable<string>(() => faker.lorem.sentence()),
    hasChildren: props?.hasChildren ?? faker.random.boolean(),
    isSelectionDisabled: props?.isSelectionDisabled ?? faker.random.boolean(),
    isEditable: props?.isEditable ?? faker.random.boolean(),
    isExpanded: props?.isExpanded ?? faker.random.boolean(),
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomNodePathElement = (depth: number = 1): NodePathElement => {
  const el: NodePathElement = {
    node: createRandomECInstancesNode(),
    index: faker.random.number(999),
    children: [],
  };
  if (faker.random.boolean()) {
    el.isMarked = faker.random.boolean();
  }
  if (faker.random.boolean()) {
    el.filteringData = {
      matchesCount: faker.random.number(),
      childMatchesCount: faker.random.number(),
    };
  }
  if (depth > 1) {
    let childrenCount = faker.random.number({ min: 1, max: 5 });
    while (childrenCount--) {
      el.children.push(createRandomNodePathElement(depth - 1));
    }
  }
  return el;
};
