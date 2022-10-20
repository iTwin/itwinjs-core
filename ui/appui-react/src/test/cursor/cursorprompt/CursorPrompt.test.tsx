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
import { selectorMatches } from "../../TestUtils";
import { render, screen } from "@testing-library/react";

describe("CursorPrompt", () => {

  beforeEach(() => {
    CursorPopupManager.clearPopups();
  });

  it("should display", async () => {
    render(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const cursorPrompt = new CursorPrompt(20, false);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"));

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(screen.getByText("Prompt string")).to.satisfy(selectorMatches(".uifw-cursor-prompt *"));

    cursorPrompt.close(false);
  });

  it("should display, update and close", () => {
    const offset = new Point(20, 20);
    const fakeTimers = sinon.useFakeTimers();
    const { container } = render(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);
    CursorPopup.fadeOutTime = 50;

    const cursorPrompt = new CursorPrompt(20, true);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"), offset, RelativePosition.BottomRight);

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(screen.getByText("Prompt string")).to.satisfy(selectorMatches(".uifw-cursor-prompt *"));

    const styleForOffset = {top: `${offset.y + 6}px`, left: `${offset.x + 6}px`};
    expect(container.querySelector<HTMLElement>(".uifw-cursorpopup")?.style).to.include(styleForOffset);

    const move = new Point(50, 60);
    CursorInformation.handleMouseMove(move);
    fakeTimers.tick(0);

    const moved = move.offset(offset);
    const styleForMoved = {top: `${moved.y}px`, left: `${moved.x}px`};
    expect(container.querySelector<HTMLElement>(".uifw-cursorpopup")?.style).to.include(styleForMoved);

    fakeTimers.tick(40);
    expect(CursorPopupManager.popupCount).to.eq(1);

    fakeTimers.tick(1000);
    fakeTimers.restore();
    expect(CursorPopupManager.popupCount).to.eq(0);
  });

  it("should close if passed a blank instruction", async () => {
    render(<CursorPopupRenderer />);
    expect(CursorPopupManager.popupCount).to.eq(0);

    const cursorPrompt = new CursorPrompt(20, false);
    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", "Prompt string"));

    expect(CursorPopupManager.popupCount).to.eq(1);
    expect(screen.getByText("Prompt string")).to.satisfy(selectorMatches(".uifw-cursor-prompt *"));

    cursorPrompt.display("icon-placeholder", ToolAssistance.createInstruction("icon-placeholder", ""));

    expect(CursorPopupManager.popupCount).to.eq(0);
  });

});
