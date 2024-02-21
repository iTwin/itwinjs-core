/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { NodePathElement } from "../../presentation-common/hierarchy/NodePathElement";
import { createRandomNodePathElement, createRandomNodePathElementJSON } from "../_helpers/random";

/* eslint-disable deprecation/deprecation */

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
