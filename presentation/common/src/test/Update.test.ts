/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  HierarchyCompareInfo, HierarchyCompareInfoJSON, HierarchyUpdateInfo, HierarchyUpdateInfoJSON, Node, NodeDeletionInfo, NodeDeletionInfoJSON,
  NodeInsertionInfo, NodeInsertionInfoJSON, NodeJSON, NodeUpdateInfo, NodeUpdateInfoJSON, PartialHierarchyModification, StandardNodeTypes, UpdateInfo,
  UpdateInfoJSON,
} from "../presentation-common";

const testNode: Node = {
  key: {
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

describe("UpdateInfo", () => {
  describe("toJSON", () => {
    it("serializes `UpdateInfo` object to JSON", () => {
      const info: UpdateInfo = {
        ["test_imodel_1"]: {
          ["test_ruleset_1"]: {
            content: "FULL",
          },
          ["test_ruleset_2"]: {
            hierarchy: "FULL",
          },
        },
        ["test_imodel_2"]: {
          ["test_ruleset_3"]: {
            hierarchy: [{
              type: "Delete",
              target: testNode.key,
            }],
          },
        },
      };
      expect(UpdateInfo.toJSON(info)).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("deserializes `UpdateInfo` object from JSON", () => {
      const json: UpdateInfoJSON = {
        ["test_imodel_1"]: {
          ["test_ruleset_1"]: {
            content: "FULL",
          },
          ["test_ruleset_2"]: {
            hierarchy: "FULL",
          },
        },
        ["test_imodel_2"]: {
          ["test_ruleset_3"]: {
            hierarchy: [{
              type: "Delete",
              target: testNodeJson.key,
            }],
          },
        },
      };
      expect(UpdateInfo.fromJSON(json)).to.matchSnapshot();
    });
  });
});

describe("HierarchyUpdateInfo", () => {
  describe("toJSON", () => {
    it("serializes \"FULL\" `HierarchyUpdateInfo` to JSON", () => {
      const info: HierarchyUpdateInfo = "FULL";
      expect(HierarchyUpdateInfo.toJSON(info)).to.eq("FULL");
    });

    it("serializes partial `HierarchyUpdateInfo` to JSON", () => {
      const info: HierarchyUpdateInfo = [{
        type: "Delete",
        target: testNode.key,
      }];
      expect(HierarchyUpdateInfo.toJSON(info)).to.matchSnapshot();
    });
  });

  describe("fromJSON", () => {
    it("deserializes \"FULL\" `HierarchyUpdateInfo` from JSON", () => {
      const json: HierarchyUpdateInfoJSON = "FULL";
      expect(HierarchyUpdateInfo.fromJSON(json)).to.eq("FULL");
    });

    it("deserializes partial `HierarchyUpdateInfo` from JSON", () => {
      const json: HierarchyUpdateInfoJSON = [{
        type: "Delete",
        target: testNodeJson.key,
      }];
      expect(HierarchyUpdateInfo.fromJSON(json)).to.matchSnapshot();
    });
  });
});

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

    it("serializes `NodeDeletionInfo`", () => {
      const info: NodeDeletionInfo = {
        type: "Delete",
        target: testNode.key,
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

    it("deserializes `NodeDeletionInfo` from JSON", () => {
      const info: NodeDeletionInfoJSON = {
        type: "Delete",
        target: testNodeJson.key,
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
            target: testNode.key,
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
            target: testNodeJson.key,
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
