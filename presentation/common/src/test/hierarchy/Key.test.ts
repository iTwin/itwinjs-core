/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import { NodeKey, StandardNodeTypes } from "../../presentation-common/hierarchy/Key.js";
import {
  createTestECClassGroupingNodeKey,
  createTestECInstanceKey,
  createTestECInstancesNodeKey,
  createTestECPropertyGroupingNodeKey,
  createTestLabelGroupingNodeKey,
  createTestNodeKey,
} from "../_helpers/index.js";

describe("NodeKey", () => {
  describe("isInstancesNodeKey", () => {
    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isInstancesNodeKey(createTestNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createTestECInstancesNodeKey())).to.be.true;
      expect(NodeKey.isInstancesNodeKey(createTestECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createTestECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstancesNodeKey(createTestLabelGroupingNodeKey())).to.be.false;
    });
  });

  describe("isClassGroupingNodeKey", () => {
    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isClassGroupingNodeKey(createTestNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createTestECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createTestECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isClassGroupingNodeKey(createTestECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createTestLabelGroupingNodeKey())).to.be.false;
    });
  });

  describe("isPropertyGroupingNodeKey", () => {
    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isPropertyGroupingNodeKey(createTestNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createTestECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createTestECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createTestECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isPropertyGroupingNodeKey(createTestLabelGroupingNodeKey())).to.be.false;
    });
  });

  describe("isLabelGroupingNodeKey", () => {
    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isLabelGroupingNodeKey(createTestNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createTestECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createTestECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createTestECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createTestLabelGroupingNodeKey())).to.be.true;
    });
  });

  describe("isGroupingNodeKey", () => {
    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isGroupingNodeKey(createTestNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createTestECInstancesNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createTestECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createTestECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createTestLabelGroupingNodeKey())).to.be.true;
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
