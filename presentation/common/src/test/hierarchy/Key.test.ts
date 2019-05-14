/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NodeKey } from "../../hierarchy/Key";
import {
  createRandomECInstanceNodeKeyJSON, createRandomECInstanceNodeKey,
  createRandomECClassGroupingNodeKey, createRandomECPropertyGroupingNodeKey,
  createRandomLabelGroupingNodeKey, createRandomBaseNodeKey,
} from "../_helpers/random";

describe("NodeKey", () => {

  describe("toJSON", () => {

    it("serializes BaseNodeKey", () => {
      const key = NodeKey.toJSON(createRandomBaseNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECInstanceNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECInstanceNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECClassGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECClassGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes ECPropertyGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomECPropertyGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("serializes LabelGroupingNodeKey", () => {
      const key = NodeKey.toJSON(createRandomLabelGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

  });

  describe("fromJSON", () => {

    it("creates BaseNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomBaseNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates ECInstanceNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECInstanceNodeKeyJSON());
      expect(key).to.matchSnapshot();
    });

    it("creates ECClassGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECClassGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates ECPropertyGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomECPropertyGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

    it("creates LabelGroupingNodeKey", () => {
      const key = NodeKey.fromJSON(createRandomLabelGroupingNodeKey());
      expect(key).to.matchSnapshot();
    });

  });

  describe("isInstanceNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isInstanceNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isInstanceNodeKey(createRandomECInstanceNodeKey())).to.be.true;
      expect(NodeKey.isInstanceNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstanceNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isInstanceNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isClassGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isClassGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isClassGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isClassGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isPropertyGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isPropertyGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.false;
    });

  });

  describe("isLabelGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isLabelGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.false;
      expect(NodeKey.isLabelGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
    });

  });

  describe("isGroupingNodeKey", () => {

    it("returns correct results for different types of nodes", () => {
      expect(NodeKey.isGroupingNodeKey(createRandomBaseNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createRandomECInstanceNodeKey())).to.be.false;
      expect(NodeKey.isGroupingNodeKey(createRandomECClassGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createRandomECPropertyGroupingNodeKey())).to.be.true;
      expect(NodeKey.isGroupingNodeKey(createRandomLabelGroupingNodeKey())).to.be.true;
    });

  });

});
