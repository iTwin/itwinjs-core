/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { TableNonPrimitiveValueRenderer } from "../../../../../ui-components/properties/renderers/value/table/NonPrimitiveValueRenderer";

describe("TableNonPrimitiveValueRenderer", () => {
  it("renders correctly", () => {
    const rendererMount = mount(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={<div><p>Hello</p></div>}
        dialogTitle={"Greeting"}
      />);
    expect(rendererMount.find("span").text()).to.be.eq("Open greeting");
  });

  // TODO: Enable, when table gets refactored
  // it("shows tooltip when hovered on", () => {
  //   const onPopupShow = sinon.spy();
  //   const onPopupHide = sinon.spy();

  //   const rendererMount = mount(
  //     <TableNonPrimitiveValueRenderer
  //       buttonLabel="Open greeting"
  //       dialogContents={<div><p>Hello</p></div>}
  //       dialogTitle={"Greeting"}
  //       onPopupHide={onPopupHide}
  //       onPopupShow={onPopupShow}
  //     />);

  //   const button = rendererMount.find("button");

  //   button.simulate("mouseenter");

  //   expect(onPopupShow.calledOnce).to.be.true;
  //   const popupContentMount = mount(<>{(onPopupShow.args[0][0] as PropertyPopupState).content}</>);
  //   expect(popupContentMount.html().indexOf("Open greeting")).to.be.greaterThan(-1);

  //   button.simulate("mouseleave");
  //   expect(onPopupHide.calledOnce).to.be.true;
  //   expect(onPopupHide.calledAfter(onPopupShow)).to.be.true;
  // });

  it("calls onDialogOpen when button gets clicked", () => {
    const onDialogOpen = sinon.spy();

    const dialogContents = <div><p>Hello</p></div>;

    const rendererMount = mount(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
        onDialogOpen={onDialogOpen}
      />);

    rendererMount.find("button").simulate("click");
    expect(onDialogOpen.calledOnce).to.be.true;
    expect(onDialogOpen.args[0][0].content).to.be.eq(dialogContents);
    expect(onDialogOpen.args[0][0].title).to.be.eq("Greeting");
  });

  it("renders DOM exactly the same when hovered on without appropriate callbacks set", () => {
    const dialogContents = <div><p>Hello</p></div>;

    const rendererMount = mount(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
      />);

    const renderedDom = rendererMount.html();

    const button = rendererMount.find("button");

    button.simulate("mouseenter");
    expect(rendererMount.html()).to.be.eq(renderedDom);

    button.simulate("mouseleave");
    expect(rendererMount.html()).to.be.eq(renderedDom);
  });

  it("renders DOM exactly the same when clicked on without appropriate callbacks set", () => {
    const dialogContents = <div><p>Hello</p></div>;

    const rendererMount = mount(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
      />);

    const renderedDom = rendererMount.html();

    const button = rendererMount.find("button");

    button.simulate("click");
    expect(rendererMount.html()).to.be.eq(renderedDom);
  });
});
