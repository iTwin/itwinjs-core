/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import HighlightingEngine, { IScrollableElement } from "../../tree/HighlightingEngine";
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

    it("does not call scrollable container when there is no active result node", () => {
      const scrollableContainerMock = moq.Mock.ofType<IScrollableElement>();
      scrollableContainerMock.setup((x) => x.getElementsByClassName("ui-components-activehighlight")).returns(() => []);

      HighlightingEngine.scrollToActiveNode(scrollableContainerMock.object);
      scrollableContainerMock.verify((x) => x.getElementsByClassName("ui-components-activehighlight"), moq.Times.once());
      scrollableContainerMock.verify((x) => x.scrollToElement(moq.It.isAny()), moq.Times.never());
    });

    it("scrolls to active element when there is active result node", () => {
      const elementBounds = {
        x: 2,
        left: 2,
        y: 4,
        top: 4,
        right: 3,
        bottom: 1,
        width: 5,
        height: 5,
      };

      const elementMock = moq.Mock.ofType<Element>();
      elementMock.setup((x) => x.getBoundingClientRect()).returns(() => elementBounds);

      const scrollableContainerMock = moq.Mock.ofType<IScrollableElement>();
      scrollableContainerMock.setup((x) => x.getElementsByClassName("ui-components-activehighlight")).returns(() => [elementMock.object]);

      HighlightingEngine.scrollToActiveNode(scrollableContainerMock.object);

      scrollableContainerMock.verify((x) => x.scrollToElement(elementBounds), moq.Times.once());
    });

    describe("when Element.prototype.scrollTo is undefined", () => {

      const scrollToFunction = Element.prototype.scrollTo;

      before(() => {
        Element.prototype.scrollTo = undefined as any;
      });

      after(() => {
        Element.prototype.scrollTo = scrollToFunction;
      });

      it("calls Element.prototype.scrollIntoView instead", () => {
        const elementMock = moq.Mock.ofType<Element>();

        const scrollableContainerMock = moq.Mock.ofType<IScrollableElement>();
        scrollableContainerMock.setup((x) => x.getElementsByClassName("ui-components-activehighlight")).returns(() => [elementMock.object]);

        HighlightingEngine.scrollToActiveNode(scrollableContainerMock.object);

        scrollableContainerMock.verify((x) => x.scrollToElement(moq.It.isAny()), moq.Times.never());
        elementMock.verify((x) => x.scrollIntoView(), moq.Times.once());
      });

    });

  });

});
