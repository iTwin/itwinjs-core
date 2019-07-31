/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import { RelativePosition, ToolAssistanceInstruction } from "@bentley/imodeljs-frontend";
import { Timer, BodyText } from "@bentley/ui-core";
import { Point } from "@bentley/ui-ninezone";

import { CursorInformation, CursorPopupManager, CursorUpdatedEventArgs, ToolAssistanceField, Icon } from "../../../ui-framework";

import "./CursorPrompt.scss";

/** @alpha */
export class CursorPrompt {
  private _timeOut: number;
  private _fadeOut: boolean;
  private _timer: Timer;
  private _relativePosition = RelativePosition.BottomRight;
  private _offset = new Point(20, 20);
  private _popupId = "cursor-prompt";

  constructor(timeOut: number, fadeOut: boolean) {
    this._timeOut = timeOut;
    this._fadeOut = fadeOut;
    this._timer = new Timer(timeOut);
  }

  public display(toolIconSpec: string, instruction: ToolAssistanceInstruction, offset: Point = new Point(20, 20), relativePosition: RelativePosition = RelativePosition.BottomRight) {
    this._relativePosition = relativePosition;
    this._offset = offset;

    const instructionImage = ToolAssistanceField.getInstructionImage(instruction);

    const promptElement = (
      <div className="uifw-cursor-prompt">
        {toolIconSpec && <span className="uifw-cursor-prompt-icon"><Icon iconSpec={toolIconSpec} /></span>}
        {instructionImage && <span className="uifw-cursor-prompt-icon">{instructionImage}</span>}
        <BodyText className="uifw-cursor-prompt-text">{instruction.text}</BodyText>
      </div >
    );

    this._startCursorPopup(promptElement);

    this._timer.setOnExecute(() => this._endCursorPopup(this._fadeOut));
    this._timer.delay = this._timeOut;
    this._timer.start();
  }

  /** @internal - unit testing */
  public close(fadeOut: boolean) {
    this._timer.stop();
    this._endCursorPopup(fadeOut);
  }

  private _startCursorPopup = (promptElement: React.ReactElement) => {
    CursorPopupManager.open(this._popupId, promptElement, CursorInformation.cursorPosition, this._offset, this._relativePosition, 0, { shadow: true });

    if (!CursorInformation.onCursorUpdatedEvent.has(this._handleCursorUpdated))
      CursorInformation.onCursorUpdatedEvent.addListener(this._handleCursorUpdated);
  }

  private _endCursorPopup = (fadeOut?: boolean) => {
    CursorPopupManager.close(this._popupId, false, fadeOut);
    CursorInformation.onCursorUpdatedEvent.removeListener(this._handleCursorUpdated);
  }

  private _handleCursorUpdated = (args: CursorUpdatedEventArgs) => {
    setTimeout(() => {
      CursorPopupManager.updatePosition(args.newPt);
    });
  }

}
