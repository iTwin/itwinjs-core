/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Tree } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable @typescript-eslint/unbound-method */

describe("<Tree />", () => {

  const createRect = (x0: number, y0: number, x1: number, y1: number): DOMRect => new DOMRect(x0, y0, x1 - x0, y1 - y0);
  const createRandomRect = () => createRect(1, 2, 3, 4);

  it("renders correctly", () => {
    render(<Tree />);

    expect(classesFromElement(screen.getByRole("tree"))).to.include("core-tree");
  });

  it("renders children correctly", () => {
    render(<Tree><div data-testid="unique" /></Tree>);

    expect(screen.getByTestId("unique")).to.exist;
  });

  describe("scrollToElement", () => {
    const overrides = {
      scrollTo: Element.prototype.scrollTo,
    };
    const scrollToSpy = sinon.spy();

    beforeEach(() => {
      Element.prototype.scrollTo = scrollToSpy;
      scrollToSpy.resetHistory();
    });

    afterEach(() => {
      Element.prototype.scrollTo = overrides.scrollTo;
    });

    it("scrolls x to 0 if current scroll is not 0 but scrolling to 0 still keeps the whole element visible", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree} style={{ overflow: "scroll" }} />);

      const treediv = screen.getByRole<HTMLDivElement>("tree");
      sinon.stub(treediv, "getBoundingClientRect").returns(createRect(1000, 0, 1100, 100));
      treediv.scrollLeft = 100;

      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRect(980, 0, 1000, 20));
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 0));
    });

    it("keeps current x scroll if the whole element is already visible", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree} style={{ overflow: "scroll" }} />);

      const treediv = screen.getByRole<HTMLDivElement>("tree");
      sinon.stub(treediv, "getBoundingClientRect").returns(createRect(1000, 0, 1100, 100));
      treediv.scrollLeft = 100;

      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRect(1000, 0, 1020, 20));
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 100));
    });

    it("scrolls to x position to make the whole element visible", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree} style={{ overflow: "scroll" }} />);

      const treediv = screen.getByRole<HTMLDivElement>("tree");
      sinon.stub(treediv, "getBoundingClientRect").returns(createRect(1000, 0, 1100, 100));
      treediv.scrollLeft = 0;

      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRect(1100, 0, 1120, 20));
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ left }) => left === 100));
    });

    it("keeps current y scroll if the whole element is already visible", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree} style={{ overflow: "scroll" }} />);

      const treediv = screen.getByRole<HTMLDivElement>("tree");
      sinon.stub(treediv, "getBoundingClientRect").returns(createRect(0, 100, 100, 220));
      treediv.scrollTop = 20;

      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRect(0, 120, 20, 140));
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ top }) => top === 20));
    });

    it("scrolls to y position to make the whole element visible", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree} style={{ overflow: "scroll" }} />);

      const treediv = screen.getByRole<HTMLDivElement>("tree");
      sinon.stub(treediv, "getBoundingClientRect").returns(createRect(0, 100, 100, 220));
      treediv.scrollLeft = 0;

      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRect(0, 220, 20, 240));
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.be.calledWithMatch(sinon.match(({ top }) => top === 120));
    });

    it("does nothing if Tree isn't mounted properly", () => {
      const tree = new Tree({});
      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRandomRect());
      tree.scrollToElement(element);
      expect(scrollToSpy).to.not.be.called;
    });

    it("does nothing if Tree is not scrollable and doesn't have a scrollable child", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree}><div /></Tree>);
      const element = document.createElement("div");
      sinon.stub(element, "getBoundingClientRect").returns(createRandomRect());
      tree.current?.scrollToElement(element);
      expect(scrollToSpy).to.not.be.called;
    });
  });

  describe("getElementsByClassName", () => {

    it("returns empty array when component is not mounted", () => {
      const instance = new Tree({});
      expect(instance.getElementsByClassName("test").length).to.eq(0);
    });

    it("returns child elements by class name", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree}><div className="test" /></Tree>);

      expect(tree.current?.getElementsByClassName("no").length).to.eq(0);
      expect(tree.current?.getElementsByClassName("test").length).to.eq(1);
    });

  });

  describe("setFocusByClassName", () => {

    it("does not set focus when element not found", () => {
      const instance = new Tree({});
      expect(instance.setFocusByClassName(".test")).to.be.false;
    });

    it("sets focus by class name", () => {
      const tree = React.createRef<Tree>();
      render(<Tree ref={tree}><button className="test" /></Tree>);

      expect(document.activeElement).not.to.eq(screen.getByRole("button"));

      expect(tree.current?.setFocusByClassName(".test")).to.be.true;
      expect(document.activeElement).to.eq(screen.getByRole("button"));
    });
  });

});
