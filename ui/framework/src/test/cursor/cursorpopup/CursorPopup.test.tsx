/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import { Logger } from "@bentley/bentleyjs-core";
import { RelativePosition } from "@bentley/ui-abstract";
import { Point } from "@bentley/ui-core";

import { CursorPopup, CursorPopupContent, CursorPopupShow } from "../../../ui-framework/cursor/cursorpopup/CursorPopup";
import { CursorPopupManager, CursorPopupOptions, CursorPopupRenderer } from "../../../ui-framework/cursor/cursorpopup/CursorPopupManager";
import { CursorInformation } from "../../../ui-framework/cursor/CursorInformation";
import TestUtils from "../../TestUtils";

describe("CursorPopup", () => {

  it("should render", () => {
    const wrapper = mount(<CursorPopupRenderer />);
    wrapper.unmount();
  });

  it("should open and close", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.close("test", false);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
  });

  it("should open, update and close", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.update("test", <div>Hello World!</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.close("test", false);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
  });

  it("should open and close with Props", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const spyClose = sinon.spy();
    const spyApply = sinon.spy();

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    const props: CursorPopupOptions = {
      title: "Title",
      onClose: spyClose,
      onApply: spyApply,
    };
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition, 0, props);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.close("test", true);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(0);

    spyClose.calledOnce.should.true;
    spyApply.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should open and close with fadeOut", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.close("test", false, true);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    const cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.state("showPopup")).to.eq(CursorPopupShow.FadeOut);

    await TestUtils.tick(1000);
    expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
  });

  it("should fadeOut correct popup", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
    CursorPopupManager.open("test", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    CursorPopupManager.open("test2", <div>Hello</div>, CursorInformation.cursorPosition, new Point(20, 20), relativePosition);
    await TestUtils.flushAsyncOperations();
    expect(CursorPopupManager.popupCount).to.eq(2);

    CursorPopupManager.close("test", false, true);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    const cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.length).to.eq(2);
    expect(cursorPopup.at(0).state("showPopup")).to.eq(CursorPopupShow.FadeOut);

    await TestUtils.tick(1000);
    expect(CursorPopupManager.popupCount).to.eq(1);

    CursorPopupManager.close("test2", false);
    expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
  });

  it("should set relativePosition", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    const center = new Point(window.innerWidth / 2, window.innerHeight / 2);

    CursorPopupManager.open("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    let cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.Top);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopRight);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.Right);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.Bottom);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomLeft);

    CursorPopupManager.update("test", <div>Hello</div>, center, new Point(20, 20), RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should set offset if more than one popup in a position", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    const center = new Point(window.innerWidth / 2, window.innerHeight / 2);
    const offset = new Point(20, 20);

    CursorPopupManager.open("test", <div>Hello</div>, center, offset, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.open("test2", <div>World</div>, center, offset, RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    const cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.length).to.eq(2);

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.Top);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.Right);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, center, offset, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    CursorPopupManager.update("test2", <div>World</div>, center, offset, RelativePosition.Left);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.close("test", false);
    CursorPopupManager.close("test2", false);

    wrapper.unmount();
  });

  it("should flip right to left appropriately", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    const lowerRight = new Point(window.innerWidth + 25, window.innerHeight);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), new Point(20, 20), RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    let cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.open("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.TopRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.open("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.Left);

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip bottom to top appropriately", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    const lowerRight = new Point(window.innerWidth + 25, window.innerHeight + 25);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), new Point(20, 20), RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    let cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.open("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.BottomLeft);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.open("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.update("test", <div>Hello</div>, lowerRight, new Point(20, 20), RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.TopLeft);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip left to right appropriately", async () => {
    const wrapper = mount(<CursorPopupRenderer />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), new Point(20, 20), RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, new Point(-30, -30), new Point(20, 20), RelativePosition.Top);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    let cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(-30, -30), new Point(20, 20), RelativePosition.Bottom);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("should flip top to bottom appropriately", async () => {
    const wrapper = mount(<CursorPopupRenderer />);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(0, 0), new Point(20, 20), RelativePosition.TopLeft);
    await TestUtils.flushAsyncOperations();

    CursorPopupManager.update("test", <div>Hello</div>, new Point(-30, -30), new Point(20, 20), RelativePosition.Left);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    let cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.open("test", <div>Hello</div>, new Point(-30, -30), new Point(20, 20), RelativePosition.Right);
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    cursorPopup = wrapper.find(CursorPopup);
    expect(cursorPopup.prop("relativePosition")).to.eq(RelativePosition.BottomRight);

    CursorPopupManager.close("test", false);

    wrapper.unmount();
  });

  it("CursorPopupContent should render", () => {
    const wrapper = mount(<CursorPopupContent>Hello world</CursorPopupContent>);
    wrapper.unmount();
  });

  it("CursorPopupManager.update should log error when id not found", () => {
    const spyMethod = sinon.spy(Logger, "logError");

    CursorPopupManager.update("xyz", <div>Hello</div>, new Point(0, 0), new Point(20, 20), RelativePosition.Left);

    spyMethod.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  it("CursorPopupManager.close should log error when id not found", () => {
    const spyMethod = sinon.spy(Logger, "logError");

    CursorPopupManager.close("xyz", false);

    spyMethod.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

});
