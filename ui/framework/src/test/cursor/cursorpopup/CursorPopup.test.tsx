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

import { CursorPopup, CursorPopupShow, CursorPopupContent } from "../../../ui-framework/cursor/cursorpopup/CursorPopup";
import { CursorPopupManager, CursorPopupProps } from "../../../ui-framework/cursor/cursorpopup/CursorPopupManager";
import { CursorInformation } from "../../../ui-framework/cursor/CursorInformation";
import TestUtils from "../../TestUtils";

describe("CursorPopup", () => {

  it("should render", () => {
    const wrapper = mount(<CursorPopup />);
    wrapper.unmount();
  });

  it("should open and close", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Open);

    CursorPopupManager.close("test", false);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    wrapper.unmount();
  });

  it("should open, update and close", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Open);

    CursorPopupManager.update("test", <div>Hello World!</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Open);

    CursorPopupManager.close("test", false);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    wrapper.unmount();
  });

  it("should open and close with Props", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    const spyClose = sinon.spy();
    const spyApply = sinon.spy();

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    const props: CursorPopupProps = {
      title: "Title",
      onClose: spyClose,
      onApply: spyApply,
    };
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition, props);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Open);

    CursorPopupManager.close("test", true);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    spyClose.calledOnce.should.true;
    spyApply.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should open and close with fadeOut", async () => {
    const wrapper = mount(<CursorPopup />);
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, 20, relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Open);

    CursorPopupManager.close("test", false, true);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.FadeOut);

    await TestUtils.tick(500);
    expect(wrapper.state("showPopup")).to.eq(CursorPopupShow.Close);

    wrapper.unmount();
  });

  it("should set relativePosition", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopRight);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomLeft);

    CursorPopupManager.updatePosition(new Point(0, 0), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip right to left appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.updatePosition(new Point(1050, 768), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(1050, 768), 20, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.TopRight);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(1050, 768), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopupManager.updatePosition(new Point(1050, 768), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopupManager.updatePosition(new Point(1050, 768), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip bottom to top appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.updatePosition(new Point(1050, 800), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(1050, 800), 20, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomLeft);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(1050, 800), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopupManager.updatePosition(new Point(1050, 800), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopupManager.updatePosition(new Point(1050, 800), 20, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip left to right appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.updatePosition(new Point(-30, -30), 20, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(-30, -30), 20, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip top to bottom appropriately", async () => {
    const wrapper = mount(<CursorPopup />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), 20, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.updatePosition(new Point(-30, -30), 20, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(-30, -30), 20, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.state("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("CursorPopupContent should render", () => {
    const wrapper = mount(<CursorPopupContent>Hello world</CursorPopupContent>);
    wrapper.unmount();
  });

});
