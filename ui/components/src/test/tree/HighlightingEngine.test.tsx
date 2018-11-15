/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import HighlightingEngine from "../../tree/HighlightingEngine";
import { BeInspireTreeNode } from "../../tree/component/BeInspireTree";

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
      const treeComponent = enzyme.shallow(<div>{HighlightingEngine.renderNodeLabel(text, { searchText, activeResultIndex: 0 })}</div>);
      const mark = treeComponent.render().find("mark");
      expect(mark.text()).to.equal(searchText);
      expect(mark.hasClass("ui-components-activehighlight")).to.be.true;
    });

  });

  describe("createRenderProps", () => {

    it("sets correct searchText", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText });
      expect(he.createRenderProps(simulateNode("id")).searchText).to.eq(searchText);
    });

    it("sets activeResultIndex to undefined when node id doesn't match activeResultNode id", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText, activeResultNode: { id: "a", index: 1 } });
      expect(he.createRenderProps(simulateNode("b")).activeResultIndex).to.be.undefined;
    });

    it("sets activeResultIndex to correct value when node id matches activeResultNode id", () => {
      const searchText = "test";
      const he = new HighlightingEngine({ searchText, activeResultNode: { id: "a", index: 1 } });
      expect(he.createRenderProps(simulateNode("a")).activeResultIndex).to.eq(1);
    });

  });

});
