/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import { HighlightingEngine } from "../../ui-components/tree/HighlightingEngine";
import { BeInspireTreeNode } from "../../ui-components/tree/component/BeInspireTree";

const simulateNode = (id: string): BeInspireTreeNode<any> => {
  return { id, text: id } as any;
};

describe("HighlightingEngine", () => {

  describe("renderNodeLabel", () => {

    it("wraps highlighted word in <mark> tag", () => {
      const text = "This is a test";
      const searchText = "test";
      const treeComponent = enzyme.shallow(<div>{HighlightingEngine.renderNodeLabel(text, { searchText })}</div>);
      expect(treeComponent.render().find("mark").text()).to.equal(searchText);
    });

    it("wraps active node <mark class=\"activeHighlight\"> tag", () => {
      const text = "This is a test";
      const searchText = "test";
      const treeComponent = enzyme.shallow(<div>{HighlightingEngine.renderNodeLabel(text, { searchText, activeMatchIndex: 0 })}</div>);
      const mark = treeComponent.render().find("mark");
      expect(mark.text()).to.equal(searchText);
      expect(mark.hasClass("components-activehighlight")).to.be.true;
    });

  });

  describe("createRenderProps", () => {

    it("sets correct searchText", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText });
      expect(he.createRenderProps(simulateNode("id")).searchText).to.eq(searchText);
    });

    it("sets activeMatchIndex to undefined when node id doesn't match nodeId in activeMatch", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText, activeMatch: { nodeId: "a", matchIndex: 1 } });
      expect(he.createRenderProps(simulateNode("b")).activeMatchIndex).to.be.undefined;
    });

    it("sets activeResultIndex to correct value when node id matches id in activeMatch", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText, activeMatch: { nodeId: "a", matchIndex: 1 } });
      expect(he.createRenderProps(simulateNode("a")).activeMatchIndex).to.eq(1);
    });

  });

});
