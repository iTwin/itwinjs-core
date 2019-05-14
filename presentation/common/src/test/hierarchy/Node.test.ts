/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Node, NodeJSON } from "../../hierarchy/Node";
import {
  createRandomECInstanceNode, createRandomECInstanceNodeKey,
  createRandomECInstanceKeyJSON,
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
  };
};

describe("Node", () => {

  describe("toJSON", () => {

    it("serializes Node", () => {
      const node = createRandomECInstanceNode();
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
