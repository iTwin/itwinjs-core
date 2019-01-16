/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  nodeKeyFromJSON,
  isInstanceNodeKey, isGroupingNodeKey, isLabelGroupingNodeKey,
  isClassGroupingNodeKey, isPropertyGroupingNodeKey,
} from "../../hierarchy/Key";
import {
  createRandomECInstanceNodeKeyJSON, createRandomECInstanceNodeKey,
  createRandomECClassGroupingNodeKey, createRandomECPropertyGroupingNodeKey,
  createRandomLabelGroupingNodeKey, createRandomBaseNodeKey
} from "../_helpers/random";

describe("NodeKey fromJSON", () => {

  it("creates BaseNodeKey", () => {
    const key = nodeKeyFromJSON(createRandomBaseNodeKey());
    expect(key).to.matchSnapshot();
  });

  it("creates ECInstanceNodeKey", () => {
    const key = nodeKeyFromJSON(createRandomECInstanceNodeKeyJSON());
    expect(key).to.matchSnapshot();
  });

  it("creates ECClassGroupingNodeKey", () => {
    const key = nodeKeyFromJSON(createRandomECClassGroupingNodeKey());
    expect(key).to.matchSnapshot();
  });

  it("creates ECPropertyGroupingNodeKey", () => {
    const key = nodeKeyFromJSON(createRandomECPropertyGroupingNodeKey());
    expect(key).to.matchSnapshot();
  });

  it("creates LabelGroupingNodeKey", () => {
    const key = nodeKeyFromJSON(createRandomLabelGroupingNodeKey());
    expect(key).to.matchSnapshot();
  });

});

describe("isInstanceNodeKey", () => {

  it("returns correct results for different types of nodes", () => {
    expect(isInstanceNodeKey(createRandomBaseNodeKey())).to.be.false;
    expect(isInstanceNodeKey(createRandomECInstanceNodeKey())).to.be.true;
    expect(isInstanceNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
    expect(isInstanceNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
    expect(isInstanceNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
  });

});

describe("isClassGroupingNodeKey", () => {

  it("returns correct results for different types of nodes", () => {
    expect(isClassGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
    expect(isClassGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
    expect(isClassGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
    expect(isClassGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
    expect(isClassGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
  });

});

describe("isPropertyGroupingNodeKey", () => {

  it("returns correct results for different types of nodes", () => {
    expect(isPropertyGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
    expect(isPropertyGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
    expect(isPropertyGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
    expect(isPropertyGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
    expect(isPropertyGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
  });

});

describe("isLabelGroupingNodeKey", () => {

  it("returns correct results for different types of nodes", () => {
    expect(isLabelGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
    expect(isLabelGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
    expect(isLabelGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
    expect(isLabelGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
    expect(isLabelGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
  });

});

describe("isGroupingNodeKey", () => {

  it("returns correct results for different types of nodes", () => {
    expect(isGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
    expect(isGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
    expect(isGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
    expect(isGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
    expect(isGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
  });

});
