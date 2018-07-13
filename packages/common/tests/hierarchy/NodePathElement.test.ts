/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NodeJSON } from "@src/hierarchy/Node";
import { NodePathElementJSON, fromJSON, listFromJSON } from "@src/hierarchy/NodePathElement";
import {
  createRandomECInstanceNode, createRandomECInstanceNodeKey, createRandomNodePathElement,
  createRandomECInstanceKeyJSON,
} from "@helpers/random";
import { ECInstanceNodeKeyJSON } from "@src/hierarchy/Key";

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

const createRandomNodePathElementJSON = (): NodePathElementJSON => {
  return {
    ...createRandomNodePathElement(),
    node: createRandomNodeJSON(),
  };
};

describe("NodePathElement fromJSON", () => {

  it("creates valid NodePathElement from JSON", () => {
    const json = createRandomNodePathElementJSON();
    const node = fromJSON(json);
    expect(node).to.matchSnapshot();
  });

  it("creates valid NodePathElement from serialized JSON", () => {
    const json = createRandomNodePathElementJSON();
    const node = fromJSON(JSON.stringify(json));
    expect(node).to.matchSnapshot();
  });

});

describe("NodePathElement[] fromJSON", () => {

  it("creates valid NodePathElement[] from JSON", () => {
    const json = [createRandomNodePathElementJSON(), createRandomNodePathElementJSON()];
    const nodes = listFromJSON(json);
    expect(nodes).to.matchSnapshot();
  });

  it("creates valid NodePathElement[] from serialized JSON", () => {
    const json = [createRandomNodePathElementJSON(), createRandomNodePathElementJSON()];
    const nodes = listFromJSON(JSON.stringify(json));
    expect(nodes).to.matchSnapshot();
  });

});
