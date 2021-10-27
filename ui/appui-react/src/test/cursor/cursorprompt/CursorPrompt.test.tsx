/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { ToolAssistance } from "@itwin/core-frontend";
import { RelativePosition } from "@itwin/appui-abstract";
import { Point } from "@itwin/core-react";
import { CursorInformation } from "../../../appui-react/cursor/CursorInformation";
import { CursorPopup } from "../../../appui-react/cursor/cursorpopup/CursorPopup";
import { CursorPopupManager, CursorPopupRenderer } from "../../../appui-react/cursor/cursorpopup/CursorPopupManager";
import { CursorPrompt } from "../../../appui-react/cursor/cursorprompt/CursorPrompt";
import TestUtils, { mount } from "../../TestUtils";

describe("CursorPrompt", () => {

  beforeEach(() => {
    CursorPopupManager.clearPopups();
  });

  it("should display", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const cursorPrompt = new CursorPrompt(20, false);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"));
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(wrapper.find("div.uifw-cursor-prompt").length).to.eq(1);

    cursorPrompt.close(false);
  });

  it("should display, update and close", () => {
    const fakeTimers = sinon.useFakeTimers();
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);
    CursorPopup.fadeOutTime = 50;

    const cursorPrompt = new CursorPrompt(20, true);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"), new Point(20, 20), RelativePosition.BottomRight);
    wrapper.update();

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(wrapper.find("div.uifw-cursor-prompt").length).to.eq(1);

    let pt: Point = wrapper.state("pt");
    expect(pt.x).to.eq(CursorInformation.cursorX);
    expect(pt.y).to.eq(CursorInformation.cursorY);

    CursorInformation.handleMouseMove(new Point(50, 60));
    fakeTimers.tick(0);

    expect(CursorPopupManager.popupCount).to.eq(1);
    pt = wrapper.state("pt");
    expect(pt.x).to.eq(50);
    expect(pt.y).to.eq(60);

    fakeTimers.tick(40);
    expect(CursorPopupManager.popupCount).to.eq(1);

    fakeTimers.tick(1000);
    fakeTimers.restore();
    expect(CursorPopupManager.popupCount).to.eq(0);
  });

  it("should close if passed a blank instruction", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const cursorPrompt = new CursorPrompt(20, false);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"));
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(wrapper.find("div.uifw-cursor-prompt").length).to.eq(1);

    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", ""));
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(CursorPopupManager.popupCount).to.eq(0);
    expect(wrapper.find("div.uifw-cursor-prompt").length).to.eq(0);
  });

});
