/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  HierarchyCompareInfo, HierarchyCompareInfoJSON, HierarchyUpdateInfo, HierarchyUpdateInfoJSON, NodeDeletionInfo, NodeDeletionInfoJSON,
  NodeInsertionInfo, NodeInsertionInfoJSON, NodeUpdateInfo, NodeUpdateInfoJSON, PartialHierarchyModification, UpdateInfo, UpdateInfoJSON,
} from "../presentation-common";
import { createRandomECInstancesNode, createRandomECInstancesNodeJSON } from "./_helpers/random";

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
              node: createRandomECInstancesNode(),
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
              node: createRandomECInstancesNodeJSON(),
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
        node: createRandomECInstancesNode(),
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
        node: createRandomECInstancesNodeJSON(),
      }];
      expect(HierarchyUpdateInfo.fromJSON(json)).to.matchSnapshot();
    });

  });

});

describe("PartialHierarchyModification", () => {

  describe("toJSON", () => {

    it("serializes `NodeInsertionInfo`", () => {
      const info: NodeInsertionInfo = {
        type: "Insert",
        position: 123,
        node: createRandomECInstancesNode(),
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeUpdateInfo`", () => {
      const info: NodeUpdateInfo = {
        type: "Update",
        node: createRandomECInstancesNode(),
        changes: [{
          name: "test",
          old: "old value",
          new: "new value",
        }],
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

    it("serializes `NodeDeletionInfo`", () => {
      const info: NodeDeletionInfo = {
        type: "Delete",
        node: createRandomECInstancesNode(),
      };
      expect(PartialHierarchyModification.toJSON(info)).to.matchSnapshot();
    });

  });

  describe("fromJSON", () => {

    it("deserializes `NodeInsertionInfo` from JSON", () => {
      const info: NodeInsertionInfoJSON = {
        type: "Insert",
        position: 123,
        node: createRandomECInstancesNodeJSON(),
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeUpdateInfo` from JSON", () => {
      const info: NodeUpdateInfoJSON = {
        type: "Update",
        node: createRandomECInstancesNodeJSON(),
        changes: [{
          name: "test",
          old: "old value",
          new: "new value",
        }],
      };
      expect(PartialHierarchyModification.fromJSON(info)).to.matchSnapshot();
    });

    it("deserializes `NodeDeletionInfo` from JSON", () => {
      const info: NodeDeletionInfoJSON = {
        type: "Delete",
        node: createRandomECInstancesNodeJSON(),
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
            node: createRandomECInstancesNode(),
          },
          {
            type: "Update",
            node: createRandomECInstancesNode(),
            changes: [{
              name: "test",
              old: "old value",
              new: "new value",
            }],
          },
          {
            type: "Delete",
            node: createRandomECInstancesNode(),
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
            node: createRandomECInstancesNodeJSON(),
          },
          {
            type: "Update",
            node: createRandomECInstancesNodeJSON(),
            changes: [{
              name: "test",
              old: "old value",
              new: "new value",
            }],
          },
          {
            type: "Delete",
            node: createRandomECInstancesNodeJSON(),
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
