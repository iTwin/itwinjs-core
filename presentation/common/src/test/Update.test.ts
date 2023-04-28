/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  HierarchyCompareInfo,
  HierarchyCompareInfoJSON,
  Node,
  NodeDeletionInfo,
  NodeDeletionInfoJSON,
  NodeInsertionInfo,
  NodeInsertionInfoJSON,
  NodeJSON,
  NodeUpdateInfo,
  NodeUpdateInfoJSON,
  PartialHierarchyModification,
  StandardNodeTypes,
} from "../presentation-common";

/* eslint-disable deprecation/deprecation */

const testNode: Node = {
  key: {
    version: 0,
    instanceKeys: [],
    pathFromRoot: [],
    type: StandardNodeTypes.ECInstancesNode,
  },
  label: {
    displayValue: "TestNode",
    rawValue: "test_node",
    typeName: "string",
  },
};

const testNodeJson: NodeJSON = {
  key: {
    instanceKeys: [],
    pathFromRoot: [],
    type: StandardNodeTypes.ECInstancesNode,
  },
  labelDefinition: {
    displayValue: "TestNode",
    rawValue: "test_node",
    typeName: "string",
  },
};

describe("PartialHierarchyModification", () => {
  describe("toJSON", () => {
    it("serializes `NodeInsertionInfo` without parent", () => {
      const info: NodeInsertionInfo = {
        type: "Insert",
        position: 123,
        node: testNode,
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeInsertionInfo` with parent", () => {
      const info: NodeInsertionInfo = {
        type: "Insert",
        parent: testNode.key,
        position: 123,
        node: testNode,
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeUpdateInfo`", () => {
      const info: NodeUpdateInfo = {
        type: "Update",
        target: testNode.key,
        changes: {
          backColor: "new value",
        },
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeDeletionInfo` with parent", () => {
      const info: NodeDeletionInfo = {
        type: "Delete",
        parent: testNode.key,
        position: 123,
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeDeletionInfo` without parent", () => {
      const info: NodeDeletionInfo = {
        type: "Delete",
        position: 123,
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("deserializes `NodeInsertionInfo` without parent from JSON", () => {
      const info: NodeInsertionInfoJSON = {
        type: "Insert",
        position: 123,
        node: testNodeJson,
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeInsertionInfo` with parent from JSON", () => {
      const info: NodeInsertionInfoJSON = {
        type: "Insert",
        parent: testNodeJson.key,
        position: 123,
        node: testNodeJson,
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeUpdateInfo` from JSON", () => {
      const info: NodeUpdateInfoJSON = {
        type: "Update",
        target: testNode.key,
        changes: {
          backColor: "new value",
        },
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeDeletionInfo` without parent from JSON", () => {
      const info: NodeDeletionInfoJSON = {
        type: "Delete",
        position: 0,
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeDeletionInfo` with parent from JSON", () => {
      const info: NodeDeletionInfoJSON = {
        type: "Delete",
        parent: testNodeJson.key,
        position: 0,
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });
  });
});

describe("HierarchyCompareInfo", () => {
  describe("toJSON", () => {
    it("serializes `HierarchyCompareInfo` to JSON", () => {
      const info: HierarchyCompareInfo = {
        changes: [
          {
            type: "Insert",
            position: 123,
            node: testNode,
          },
          {
            type: "Update",
            target: testNode.key,
            changes: {
              backColor: "new value",
            },
          },
          {
            type: "Delete",
            parent: testNode.key,
            position: 0,
          },
        ],
        continuationToken: {
          prevHierarchyNode: "prevHierarchyNode",
          currHierarchyNode: "currHierarchyNode",
        },
      };
      expect(HierarchyCompareInfo.toJSON(info)).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("deserializes `HierarchyCompareInfo` from JSON", () => {
      const info: HierarchyCompareInfoJSON = {
        changes: [
          {
            type: "Insert",
            position: 123,
            node: testNodeJson,
          },
          {
            type: "Update",
            target: testNodeJson.key,
            changes: {
              backColor: "new value",
            },
          },
          {
            type: "Delete",
            parent: testNodeJson.key,
            position: 0,
          },
        ],
        continuationToken: {
          prevHierarchyNode: "prevHierarchyNode",
          currHierarchyNode: "currHierarchyNode",
        },
      };
      expect(HierarchyCompareInfo.fromJSON(info)).to.matchSnapshot();
    });
  });
});
