/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  createRandomECInstancesNode, createRandomECInstancesNodeKeyJSON, createRandomLabelDefinitionJSON,
} from "../_helpers/random";
import { Node, NodeJSON } from "../../presentation-common/hierarchy/Node";

const createRandomNodeJSON = (): NodeJSON => {
  return {
    ...createRandomECInstancesNode(),
    key: createRandomECInstancesNodeKeyJSON(),
    labelDefinition: createRandomLabelDefinitionJSON(),
  };
};

describe("Node", () => {

  describe("toJSON", () => {

    it("serializes Node", () => {
      const node = createRandomECInstancesNode();
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
