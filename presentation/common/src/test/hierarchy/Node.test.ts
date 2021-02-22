/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { StandardNodeTypes } from "../../presentation-common/hierarchy/Key";
import { Node, NodeJSON } from "../../presentation-common/hierarchy/Node";

describe("Node", () => {
  const testNodeJson: NodeJSON = {
    key: { instanceKeys: [], pathFromRoot: [], type: StandardNodeTypes.ECInstancesNode },
    labelDefinition: { displayValue: "TestNode", rawValue: "test_node", typeName: "string" },
    description: "test description",
  };

  const testNode: Node = {
    key: { instanceKeys: [], pathFromRoot: [], type: StandardNodeTypes.ECInstancesNode },
    label: { displayValue: "TestNode", rawValue: "test_node", typeName: "string" },
    description: "test description",
  };

  describe("toJSON", () => {
    it("serializes Node", () => {
      const json = Node.toJSON(testNode);
      expect(json).to.deep.equal(testNodeJson);
    });
  });

  describe("fromJSON", () => {
    it("creates valid Node from JSON", () => {
      const node = Node.fromJSON(testNodeJson);
      expect(node).to.deep.equal(testNode);
    });

    it("creates valid Node from serialized JSON", () => {
      const node = Node.fromJSON(JSON.stringify(testNodeJson));
      expect(node).to.deep.equal(testNode);
    });
  });

  describe("listFromJSON", () => {
    it("creates valid Node[] from JSON", () => {
      const json = [testNodeJson, testNodeJson];
      const nodes = Node.listFromJSON(json);
      expect(nodes).to.deep.equal([testNode, testNode]);
    });

    it("creates valid Node[] from serialized JSON", () => {
      const json = [testNodeJson, testNodeJson];
      const nodes = Node.listFromJSON(JSON.stringify(json));
      expect(nodes).to.deep.equal([testNode, testNode]);
    });
  });
});
