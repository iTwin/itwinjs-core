/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import { ToolAssistance, RelativePosition } from "@bentley/imodeljs-frontend";
import { Point } from "@bentley/ui-core";

import { CursorPrompt } from "../../../ui-framework/cursor/cursorprompt/CursorPrompt";
import { CursorInformation } from "../../../ui-framework/cursor/CursorInformation";
import { CursorPopupRenderer, CursorPopupManager } from "../../../ui-framework/cursor/cursorpopup/CursorPopupManager";

import TestUtils from "../../TestUtils";

describe("CursorPrompt", () => {

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
    expect(CursorPopupManager.popupCount).to.eq(0);

    wrapper.unmount();
  });

});
