/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import { RelativePosition } from "@bentley/imodeljs-frontend";
import { Point } from "@bentley/ui-ninezone";

import { CursorPopup, CursorPopupProps } from "../../../ui-framework/cursor/cursorpopup/CursorPopup";
import { CursorInformation } from "../../../ui-framework/cursor/CursorInformation";
import TestUtils from "../../TestUtils";

describe("CursorPopup", () => {

  it("should render", () => {
    const wrapper = mount(<CursorPopup />);
    wrapper.unmount();
  });

  it("should open and close", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.be.false;

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopup.open(<div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.true;

    CursorPopup.close(false);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.false;

    wrapper.unmount();
  });

  it("should open, update and close", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.be.false;

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopup.open(<div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.true;

    CursorPopup.update(<div>Hello World!</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.true;

    CursorPopup.close(false);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.false;

    wrapper.unmount();
  });

  it("should open and close with Props", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.be.false;

    const spyClose = sinon.spy();
    const spyApply = sinon.spy();

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    const props: CursorPopupProps = {
      title: "Title",
      onClose: spyClose,
      onApply: spyApply,
    };
    CursorPopup.open(<div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition, props);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.true;

    CursorPopup.close(true);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.be.false;

    spyClose.calledOnce.should.true;
    spyApply.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should set relativePosition", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopup.open(<div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopRight);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomLeft);

    CursorPopup.updatePosition(new Point(0, 0), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopup.close(false);

    wrapper.unmount();
  });

  it("should flip right to left appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopup.open(<div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopup.updatePosition(new Point(1050, 768), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopup.open(<div>Hello</div>, new Point(1050, 768), 20, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopRight);

    CursorPopup.open(<div>Hello</div>, new Point(1050, 768), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopup.updatePosition(new Point(1050, 768), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopup.updatePosition(new Point(1050, 768), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopup.close(false);

    wrapper.unmount();
  });

  it("should flip bottom to top appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopup.open(<div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopup.updatePosition(new Point(1050, 800), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopup.open(<div>Hello</div>, new Point(1050, 800), 20, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomLeft);

    CursorPopup.open(<div>Hello</div>, new Point(1050, 800), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopup.updatePosition(new Point(1050, 800), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopup.updatePosition(new Point(1050, 800), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopup.close(false);

    wrapper.unmount();
  });

  it("should flip left to right appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopup.open(<div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopup.updatePosition(new Point(-30, -30), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopup.open(<div>Hello</div>, new Point(-30, -30), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopup.close(false);

    wrapper.unmount();
  });

  it("should flip top to bottom appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopup.open(<div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopup.updatePosition(new Point(-30, -30), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopup.open(<div>Hello</div>, new Point(-30, -30), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopup.close(false);

    wrapper.unmount();
  });

});
