/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import HighlightingEngine, { IScrollableElement } from "../../src/tree/HighlightingEngine";
// import Tree from "../../src/tree/component/Tree";
// import InspireTree from "inspire-tree";

describe("HighlightingEngine", () => {
  describe("getNodeLabelComponent", () => {
    it("Expect highlighted word to be wrapped in <mark> tag", () => {
      const searchText = "test";
      const highlightingEngine = new HighlightingEngine({ searchText, activeResultNode: { id: "", index: 0 } });
      const node = { text: "This is a test" };

      const treeComponent = enzyme.mount(<div>{highlightingEngine.getNodeLabelComponent(node as any)}</div>);

      expect(treeComponent.render().find("Mark").text()).to.be.equal(searchText);
    });

    it("Expect active node to be wrapped in <mark class=\"activeHighlight\"> tag", () => {
      const searchText = "test";
      const highlightingEngine = new HighlightingEngine({ searchText, activeResultNode: { id: "#test#", index: 0 } });
      const node = { text: "This is a test", id: "#test#" };

      const treeComponent = enzyme.mount(<div>{highlightingEngine.getNodeLabelComponent(node as any)}</div>);

      expect(treeComponent.render().find("Mark").text()).to.be.equal(searchText);
      expect(treeComponent.render().find("Mark").hasClass("ui-components-activehighlight")).to.be.true;
    });

    it("Expect node label to be simple string wrapped in <div> when seachWord is empty", () => {
      const searchText = "";
      const highlightingEngine = new HighlightingEngine({ searchText, activeResultNode: { id: "#test#", index: 0 } });
      const node = { text: "This is a test" };

      enzyme.mount(<div>{highlightingEngine.getNodeLabelComponent(node as any)}</div>).should.matchSnapshot();
    });
  });

  describe("scrollToActiveNode", () => {
    let scrollToAdded = false;
    let scrollIntoViewAdded = false;

    before(() => {
      if (!Element.prototype.scrollTo) {
        Element.prototype.scrollTo = () => { };
        scrollToAdded = true;
      }
      if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => { };
        scrollIntoViewAdded = true;
      }
    });

    after(() => {
      if (scrollToAdded) {
        Element.prototype.scrollTo = undefined as any;
        scrollIntoViewAdded = false;
      }
      if (scrollIntoViewAdded) {
        Element.prototype.scrollIntoView = undefined as any;
        scrollIntoViewAdded = false;
      }
    });

    it("Does not call scrollable element when there is no active result node", () => {
      const highlightingEngine = new HighlightingEngine({ searchText: "" });
      let scrollableElementCalled = false;
      const scrollableElementMock: IScrollableElement = {
        scrollToElement: () => { scrollableElementCalled = true; },
      };

      highlightingEngine.scrollToActiveNode(scrollableElementMock);

      expect(scrollableElementCalled).to.be.false;
    });

    it("Calls scrollable element when there is active result node", () => {
      const highlightingEngine = new HighlightingEngine({ searchText: "test", activeResultNode: { id: "#node1#", index: 0 } });
      let scrollableElementCalled = false;

      const node = { id: "#node1#", text: "This is a test" };

      const scrollableElementMock: IScrollableElement = {
        scrollToElement: () => { scrollableElementCalled = true; },
      };

      enzyme.mount(<div>{highlightingEngine.getNodeLabelComponent(node as any)}</div>);

      highlightingEngine.scrollToActiveNode(scrollableElementMock);

      expect(scrollableElementCalled).to.be.true;
    });

    describe("Element.prototype.scrollTo is undefined", () => {
      const scrollToFunction = Element.prototype.scrollTo;
      const scrollIntoViewFunction = Element.prototype.scrollIntoView;
      let scrollIntoViewCalled = false;

      before(() => {
        Element.prototype.scrollTo = undefined as any;
        Element.prototype.scrollIntoView = () => { scrollIntoViewCalled = true; };
      });

      after(() => {
        Element.prototype.scrollTo = scrollToFunction;
        Element.prototype.scrollIntoView = scrollIntoViewFunction;
      });

      it("Element.prototype.scrollIntoView called instead", () => {
        const highlightingEngine = new HighlightingEngine({ searchText: "test", activeResultNode: { id: "#node1#", index: 0 } });
        let scrollableElementCalled = false;

        const node = { id: "#node1#", text: "This is a test" };

        const scrollableElementMock: IScrollableElement = {
          scrollToElement: () => { scrollableElementCalled = true; },
        };

        enzyme.mount(<div>{highlightingEngine.getNodeLabelComponent(node as any)}</div>);

        highlightingEngine.scrollToActiveNode(scrollableElementMock);

        expect(scrollIntoViewCalled).to.be.true;
        expect(scrollableElementCalled).to.be.false;
      });
    });
  });
});
