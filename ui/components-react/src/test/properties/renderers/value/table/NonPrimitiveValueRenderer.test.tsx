/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { TableNonPrimitiveValueRenderer } from "../../../../../components-react/properties/renderers/value/table/NonPrimitiveValueRenderer";

describe("TableNonPrimitiveValueRenderer", () => {
  const dialogContents = <div><p>Hello</p></div>;

  it("renders correctly", () => {
    const renderer = render(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
      />);

    // Verify that text "Open greeting" is renderer. Throws otherwise
    renderer.getByText("Open greeting");
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

    const renderer = render(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
        onDialogOpen={onDialogOpen}
      />);

    const button = renderer.container.getElementsByClassName("core-underlined-button")[0];
    fireEvent.click(button);

    expect(onDialogOpen.calledOnce).to.be.true;
    expect(onDialogOpen.args[0][0].content).to.be.eq(dialogContents);
    expect(onDialogOpen.args[0][0].title).to.be.eq("Greeting");
  });

  it("renders DOM exactly the same when hovered on without appropriate callbacks set", () => {
    const renderer = render(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
      />);

    const renderedDom = renderer.container.innerHTML;

    const button = renderer.container.getElementsByClassName("core-underlined-button")[0];

    fireEvent.mouseEnter(button);
    expect(renderer.container.innerHTML).to.be.eq(renderedDom);

    fireEvent.mouseLeave(button);
    expect(renderer.container.innerHTML).to.be.eq(renderedDom);
  });

  it("renders DOM exactly the same when clicked on without appropriate callbacks set", () => {
    const renderer = render(
      <TableNonPrimitiveValueRenderer
        buttonLabel="Open greeting"
        dialogContents={dialogContents}
        dialogTitle={"Greeting"}
      />);

    const renderedDom = renderer.container.innerHTML;

    const button = renderer.container.getElementsByClassName("core-underlined-button")[0];

    fireEvent.click(button);

    expect(renderer.container.innerHTML).to.be.eq(renderedDom);
  });
});
