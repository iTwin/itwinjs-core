/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NodeJSON, fromJSON, listFromJSON } from "../../lib/hierarchy/Node";
import {
  createRandomECInstanceNode, createRandomECInstanceNodeKey,
  createRandomECInstanceKeyJSON,
} from "../_helpers/random";
import { ECInstanceNodeKeyJSON } from "../../lib/hierarchy/Key";

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

describe("Node fromJSON", () => {

  it("creates valid Node from JSON", () => {
    const json = createRandomNodeJSON();
    const node = fromJSON(json);
    expect(node).to.matchSnapshot();
  });

  it("creates valid Node from serialized JSON", () => {
    const json = createRandomNodeJSON();
    const node = fromJSON(JSON.stringify(json));
    expect(node).to.matchSnapshot();
  });

});

describe("Node[] fromJSON", () => {

  it("creates valid Node[] from JSON", () => {
    const json = [createRandomNodeJSON(), createRandomNodeJSON()];
    const nodes = listFromJSON(json);
    expect(nodes).to.matchSnapshot();
  });

  it("creates valid Node[] from serialized JSON", () => {
    const json = [createRandomNodeJSON(), createRandomNodeJSON()];
    const nodes = listFromJSON(JSON.stringify(json));
    expect(nodes).to.matchSnapshot();
  });

});
