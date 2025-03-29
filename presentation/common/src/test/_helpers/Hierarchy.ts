/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import {
  ECClassGroupingNodeKey,
  ECInstancesNodeKey,
  ECPropertyGroupingNodeKey,
  LabelDefinition,
  LabelGroupingNodeKey,
  Node,
  NodeKey,
  NodePathElement,
  StandardNodeTypes,
} from "../../presentation-common.js";
import { createTestLabelDefinition } from "./Content.js";
import { createTestECInstanceKey } from "./EC.js";

/** @internal Used for testing only. */
export const createTestNodeKey = (props?: Partial<NodeKey>) => ({
  type: "test-node",
  version: 0,
  pathFromRoot: [],
  ...props,
});

export const createTestECInstancesNodeKey = (props?: Partial<ECInstancesNodeKey>): ECInstancesNodeKey => ({
  ...createTestNodeKey(),
  type: StandardNodeTypes.ECInstancesNode,
  instanceKeys: [createTestECInstanceKey()],
  ...props,
});

/** @internal Used for testing only. */
export const createTestECClassGroupingNodeKey = (props?: Partial<ECClassGroupingNodeKey>): ECClassGroupingNodeKey => ({
  ...createTestNodeKey(),
  type: StandardNodeTypes.ECClassGroupingNode,
  className: "SchemaName:ClassName",
  groupedInstancesCount: 1,
  ...props,
});

/** @internal Used for testing only. */
export const createTestECPropertyGroupingNodeKey = (props?: Partial<ECPropertyGroupingNodeKey>): ECPropertyGroupingNodeKey => ({
  ...createTestNodeKey(),
  type: StandardNodeTypes.ECPropertyGroupingNode,
  className: "SchemaName:ClassName",
  propertyName: "PropertyName",
  groupingValues: [123],
  groupedInstancesCount: 1,
  ...props,
});

/** @internal Used for testing only. */
export const createTestLabelGroupingNodeKey = (props?: Partial<LabelGroupingNodeKey>): LabelGroupingNodeKey => ({
  ...createTestNodeKey(),
  type: StandardNodeTypes.DisplayLabelGroupingNode,
  label: "Test label",
  groupedInstancesCount: 1,
  ...props,
});

/** @internal Used for testing only. */
export const createTestECInstancesNode = (props?: Partial<Node & { key: ECInstancesNodeKey }>): Node & { key: ECInstancesNodeKey } => ({
  key: createTestECInstancesNodeKey(props?.key),
  label: createTestLabelDefinition(),
  ...props,
});

/** @internal Used for testing only. */
export const createTestNode = (props?: Partial<Node>): Node => ({
  key: createTestNodeKey(),
  label: LabelDefinition.fromLabelString("test label"),
  ...props,
});

/** @internal Used for testing only. */
export const createTestNodePathElement = (props?: Partial<NodePathElement>): NodePathElement => ({
  node: createTestNode(),
  index: 0,
  children: [],
  ...props,
});
