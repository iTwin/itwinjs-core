/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NodePathElement } from "../../hierarchy/NodePathElement";
import { createRandomNodePathElement, createRandomNodePathElementJSON } from "../_helpers/random";

describe("NodePathElement", () => {

  describe("toJSON", () => {

    it("serializes NodePathElement", () => {
      const npe = { ...createRandomNodePathElement(), isMarked: true };
      const json = NodePathElement.toJSON(npe);
      expect(json).to.matchSnapshot();
    });

    it("serializes NodePathElement with undefined `isMarked` flag", () => {
      const npe = { ...createRandomNodePathElement(), isMarked: undefined };
      const json = NodePathElement.toJSON(npe);
      expect(json).to.matchSnapshot();
    });

    it("serializes NodePathElement with undefined filtering data", () => {
      const npe = { ...createRandomNodePathElement(), filteringData: undefined };
      const json = NodePathElement.toJSON(npe);
      expect(json).to.matchSnapshot();
    });

  });

  describe("fromJSON", () => {

    it("creates valid NodePathElement from JSON", () => {
      const json = createRandomNodePathElementJSON();
      const node = NodePathElement.fromJSON(json);
      expect(node).to.matchSnapshot();
    });

    it("creates valid NodePathElement from serialized JSON", () => {
      const json = createRandomNodePathElementJSON();
      const node = NodePathElement.fromJSON(JSON.stringify(json));
      expect(node).to.matchSnapshot();
    });

  });

  describe("listFromJSON", () => {

    it("creates valid NodePathElement[] from JSON", () => {
      const json = [createRandomNodePathElementJSON(), createRandomNodePathElementJSON()];
      const nodes = NodePathElement.listFromJSON(json);
      expect(nodes).to.matchSnapshot();
    });

    it("creates valid NodePathElement[] from serialized JSON", () => {
      const json = [createRandomNodePathElementJSON(), createRandomNodePathElementJSON()];
      const nodes = NodePathElement.listFromJSON(JSON.stringify(json));
      expect(nodes).to.matchSnapshot();
    });

  });

});
