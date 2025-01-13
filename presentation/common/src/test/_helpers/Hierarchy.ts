/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { LabelDefinition, Node, NodeKey } from "../../presentation-common";

/**
 * @internal Used for testing only.
 */
export const createTestNodeKey = (props?: Partial<NodeKey>) => ({
  type: "test-node",
  version: 0,
  pathFromRoot: [],
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestNode = (props?: Partial<Node>) => ({
  key: createTestNodeKey(),
  label: LabelDefinition.fromLabelString("test label"),
  ...props,
});
