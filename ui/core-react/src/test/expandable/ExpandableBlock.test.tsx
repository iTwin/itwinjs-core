/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { ExpandableBlock } from "../../core-react";
import TestUtils, { classesFromElement } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* eslint-disable deprecation/deprecation */

describe("ExpandableBlock", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<ExpandableBlock />", () => {
    it("should render collapsed", () => {
      render(
        <ExpandableBlock title="Test" isExpanded={false} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(classesFromElement(screen.getByRole("button").parentElement)).to.include("is-collapsed");
    });

    it("should render expanded", () => {
      render(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(classesFromElement(screen.getByRole("button").parentElement)).to.include("is-expanded");
    });

    it("should render with caption", () => {
      render(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()} caption="Test Caption">
          <div>Hello</div>
        </ExpandableBlock>);
      expect(classesFromElement(screen.getByRole("button").parentElement)).to.include("with-caption");
      expect(screen.getByText("Test Caption")).to.exist;
    });

    it("should render with title given in a tooltip", () => {
      render(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()} tooltip={"hello"}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(screen.getByTitle("hello")).to.equal(screen.getByText("Test"));
    });

    it("should render empty title if tooltip is not given and title is React.JSX.Element", () => {
      const title = <span>JSX Title</span>; // title may be React.JSX.Element when passing a highlighted text
      render(
        <ExpandableBlock title={title} isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(screen.getByText("JSX Title").parentElement?.title).to.be.empty;
    });

    it("should support click", async () => {
      const spyMethod = sinon.fake();
      render(
        <ExpandableBlock title="Test" isExpanded={true} onClick={spyMethod}>
          <div>Hello</div>
        </ExpandableBlock>);

      await theUserTo.click(screen.getByRole("button"));
      spyMethod.calledOnce.should.true;
    });

    it("should support keypress", async () => {
      const spyMethod = sinon.fake();
      render(
        <ExpandableBlock title={"Test"} isExpanded={true} onClick={sinon.spy()} onKeyPress={spyMethod}>
          <div>Hello</div>
        </ExpandableBlock>);
      await theUserTo.tab();
      await theUserTo.keyboard("t");
      spyMethod.calledOnce.should.true;
    });
  });
});
