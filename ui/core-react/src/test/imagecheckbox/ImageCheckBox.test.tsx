/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { ImageCheckBox } from "../../core-react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";

describe("<ImageCheckBox />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });
  it("toggles correctly", async () => {
    const spy = sinon.spy();
    render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" onClick={spy} />,
    );
    await theUserTo.click(screen.getByRole("checkbox"));
    expect(spy).to.have.been.calledOnceWith(true);
    spy.resetHistory();
    await theUserTo.click(screen.getByRole("checkbox"));
    expect(spy).to.have.been.calledOnceWith(false);
  });

  it("disabled do not react on click", async () => {
    const spy = sinon.spy();
    render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" disabled={true} onClick={spy} />,
    );
    await theUserTo.click(screen.getByRole("checkbox"));
    expect(spy).not.to.have.been.called;
  });

  it("onClick should be called on label click", async () => {
    const spy = sinon.spy();
    render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" onClick={spy} tooltip={"test"}/>,
    );
    await theUserTo.click(screen.getByTitle("test"));
    expect(spy).to.have.been.called;
  });

  it("border renders correctly", () => {
    const {container} = render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" border={true} />,
    );
    expect(container.querySelector(".image-checkbox-border")).to.exist;
  });

  it("renders on correctly", () => {
    const {container} = render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" checked={true} />,
    );
    expect(container.querySelector(".icon.icon-visibility")).to.exist;
  });

  it("render off correctly", () => {
    const {container} = render(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" checked={false} />,
    );
    expect(container.querySelector(".icon.icon-visibility-hide-2")).to.exist;
  });

  it("onClick should be called on change", async () => {
    const handler = sinon.spy();
    render(<ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" onClick={handler} checked={false} />);
    await theUserTo.click(screen.getByRole("checkbox"));
    handler.should.have.been.calledOnce;
    handler.should.have.been.calledWithExactly(true);
  });
});
