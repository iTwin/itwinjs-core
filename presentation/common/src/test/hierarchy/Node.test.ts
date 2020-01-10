/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Node, NodeJSON } from "../../hierarchy/Node";
import {
  createRandomECInstanceNode, createRandomECInstanceNodeKey,
  createRandomECInstanceKeyJSON,
  createRandomLabelDefinitionJSON,
} from "../_helpers/random";
import { ECInstanceNodeKeyJSON } from "../../hierarchy/Key";

const createRandomECInstanceNodeKeyJSON = (): ECInstanceNodeKeyJSON => {
  return {
    ...createRandomECInstanceNodeKey(),
    instanceKey: createRandomECInstanceKeyJSON(),
  };
};

const createRandomNodeJSON = (): NodeJSON => {
  return {
    ...createRandomECInstanceNode(),
    key: createRandomECInstanceNodeKeyJSON(),
    labelDefinition: createRandomLabelDefinitionJSON(),
  };
};

describe("Node", () => {

  describe("toJSON", () => {

    it("serializes Node", () => {
      const node = createRandomECInstanceNode();
      const json = Node.toJSON(node);
      expect(json).to.matchSnapshot();
    });

    it("serializes Node without labelDefinition", () => {
      const node = createRandomECInstanceNode();
      node.labelDefinition = undefined;
      const json = Node.toJSON(node);
      expect(json).to.matchSnapshot();
    });

  });

  describe("fromJSON", () => {

    it("creates valid Node from JSON", () => {
      const json = createRandomNodeJSON();
      const node = Node.fromJSON(json);
      expect(node).to.matchSnapshot();
    });

    it("creates valid Node from serialized JSON", () => {
      const json = createRandomNodeJSON();
      const node = Node.fromJSON(JSON.stringify(json));
      expect(node).to.matchSnapshot();
    });

  });

  describe("listFromJSON", () => {

    it("creates valid Node[] from JSON", () => {
      const json = [createRandomNodeJSON(), createRandomNodeJSON()];
      const nodes = Node.listFromJSON(json);
      expect(nodes).to.matchSnapshot();
    });

    it("creates valid Node[] from serialized JSON", () => {
      const json = [createRandomNodeJSON(), createRandomNodeJSON()];
      const nodes = Node.listFromJSON(JSON.stringify(json));
      expect(nodes).to.matchSnapshot();
    });

  });

});
