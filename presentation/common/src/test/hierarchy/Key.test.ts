/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NodeKey, StandardNodeTypes } from "../../presentation-common/hierarchy/Key";
import { createTestECInstanceKey } from "../_helpers/EC";
import { createTestNodeKey } from "../_helpers/Hierarchy";
import {
  createRandomBaseNodeKey, createRandomECClassGroupingNodeKey, createRandomECInstancesNodeKey, createRandomECInstancesNodeKeyJSON,
  createRandomECPropertyGroupingNodeKey, createRandomLabelGroupingNodeKey,
} from "../_helpers/random";

describe("NodeKey", () => {

  describe("toJSON", () => {

    it("serializes BaseNodeKey", () => {
      const key = NodeKey.toJSON(createRandomBaseNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECInstancesNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECInstancesNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECClassGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECClassGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECPropertyGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECPropertyGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes LabelGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomLabelGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

  });

  describe("fromJSON", () => {

    it("creates BaseNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomBaseNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates ECInstancesNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECInstancesNodeKeyJSON());
      expect(key).to.matchSnapshot();
    });

    it("creates ECClassGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECClassGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates ECPropertyGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECPropertyGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates LabelGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomLabelGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

  });

  describe("isInstancesNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isInstancesNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createRandomECInstancesNodeKey())).to.be.true;
      expect(NodeKey.isInstancesNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isClassGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isClassGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isPropertyGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isLabelGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isLabelGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
    });

  });

  describe("isGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createRandomECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
    });

  });

  describe("equals", () => {

    it("returns `false` when types are different", () => {
      const lhs = createTestNodeKey({ type: "a" });
      const rhs = createTestNodeKey({ type: "b" });
      expect(NodeKey.equals(lhs, rhs)).to.be.false;
    });

    it("returns `false` when `pathFromRoot` lengths are different", () => {
      const lhs = createTestNodeKey({ pathFromRoot: ["a", "b"] });
      const rhs = createTestNodeKey({ pathFromRoot: ["a", "b", "c"] });
      expect(NodeKey.equals(lhs, rhs)).to.be.false;
    });

    describe("when versions are equal", () => {

      it("returns `false` when `pathFromRoot` contents are different", () => {
        const lhs = createTestNodeKey({ version: 999, pathFromRoot: ["a", "b"] });
        const rhs = createTestNodeKey({ version: 999, pathFromRoot: ["a", "c"] });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `true` when `pathFromRoot` contents are similar", () => {
        const lhs = createTestNodeKey({ version: 999, pathFromRoot: ["a", "b"] });
        const rhs = createTestNodeKey({ version: 999, pathFromRoot: ["a", "b"] });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

    });

    describe("when versions are different", () => {

      it("returns `false` when instance key counts are different for instance node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })],
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" }), createTestECInstanceKey({ id: "0x3" })],
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `false` when instance keys are different for instance node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })],
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x3" })],
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `true` when instance keys are similar for instance node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })],
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECInstancesNode,
          instanceKeys: [createTestECInstanceKey({ id: "0x1" }), createTestECInstanceKey({ id: "0x2" })],
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

      it("returns `false` when class names are different for class grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECClassGroupingNode,
          className: "a",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECClassGroupingNode,
          className: "b",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `true` when class names are similar for class grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECClassGroupingNode,
          className: "a",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECClassGroupingNode,
          className: "a",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

      it("returns `false` when class names are different for property grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "a",
          propertyName: "p",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "b",
          propertyName: "p",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `false` when property names are different for property grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "a",
          propertyName: "p1",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "a",
          propertyName: "p2",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `true` when class and property names are similar for property grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "a",
          propertyName: "p",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.ECPropertyGroupingNode,
          className: "a",
          propertyName: "p",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

      it("returns `false` when labels are different for label grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.DisplayLabelGroupingNode,
          label: "a",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.DisplayLabelGroupingNode,
          label: "b",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.false;
      });

      it("returns `true` when labels are similar for label grouping node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
          type: StandardNodeTypes.DisplayLabelGroupingNode,
          label: "a",
        });
        const rhs = createTestNodeKey({
          version: 2,
          type: StandardNodeTypes.DisplayLabelGroupingNode,
          label: "a",
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

      it("returns `true` when types and `pathFromRoot` lengths are equal for base node keys", () => {
        const lhs = createTestNodeKey({
          version: 1,
        });
        const rhs = createTestNodeKey({
          version: 2,
        });
        expect(NodeKey.equals(lhs, rhs)).to.be.true;
      });

    });

  });

});
