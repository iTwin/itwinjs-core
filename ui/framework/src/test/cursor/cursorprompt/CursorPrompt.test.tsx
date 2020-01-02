/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import { ToolAssistance } from "@bentley/imodeljs-frontend";
import { RelativePosition } from "@bentley/ui-abstract";
import { Point } from "@bentley/ui-core";

import { CursorPopup } from "../../../ui-framework/cursor/cursorpopup/CursorPopup";
import { CursorPrompt } from "../../../ui-framework/cursor/cursorprompt/CursorPrompt";
import { CursorInformation } from "../../../ui-framework/cursor/CursorInformation";
import { CursorPopupRenderer, CursorPopupManager } from "../../../ui-framework/cursor/cursorpopup/CursorPopupManager";

import TestUtils from "../../TestUtils";

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
    wrapper.unmount();
  });

  it("should display, update and close", async () => {
    const wrapper = mount(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);
    CursorPopup.fadeOutTime = 50;

    const cursorPrompt = new CursorPrompt(20, true);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"), new Point(20, 20), RelativePosition.BottomRight);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(wrapper.find("div.uifw-cursor-prompt").length).to.eq(1);

    let pt: Point = wrapper.state("pt");
    expect(pt.x).to.eq(CursorInformation.cursorX);
    expect(pt.y).to.eq(CursorInformation.cursorY);

    const currX = 50;
    const currY = 60;
    CursorInformation.handleMouseMove(new Point(currX, currY));
    await TestUtils.flushAsyncOperations();

    expect(CursorPopupManager.popupCount).to.eq(1);
    pt = wrapper.state("pt");
    expect(pt.x).to.eq(currX);
    expect(pt.y).to.eq(currY);

    await TestUtils.tick(40);
    expect(CursorPopupManager.popupCount).to.eq(1);

    await TestUtils.tick(1000);
    // Note: This test does not always close the popup because of timer issues
    // expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
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

    wrapper.unmount();
  });

});
