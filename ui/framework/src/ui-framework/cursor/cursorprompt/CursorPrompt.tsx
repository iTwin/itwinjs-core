/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import { RelativePosition, ToolAssistanceInstruction } from "@bentley/imodeljs-frontend";
import { Timer, BodyText } from "@bentley/ui-core";

import { CursorInformation, CursorPopupManager, CursorUpdatedEventArgs, ToolAssistanceField, Icon } from "../../../ui-framework";

import "./CursorPrompt.scss";

/** @alpha */
export class CursorPrompt {
  private _timeOut: number;
  private _timer: Timer;
  private _relativePosition = RelativePosition.BottomRight;
  private _offset = 20;
  private _popupId = "cursor-prompt";

  constructor(timeOut: number) {
    this._timeOut = timeOut;
    this._timer = new Timer(timeOut);
  }

  public display(toolIconSpec: string, instruction: ToolAssistanceInstruction, offset: number = 20, relativePosition: RelativePosition = RelativePosition.BottomRight) {
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

    this._timer.setOnExecute(this._endCursorPopup);
    this._timer.delay = this._timeOut;
    this._timer.start();
  }

  public close() {
    this._timer.stop();
    this._endCursorPopup();
  }

  private _startCursorPopup = (promptElement: React.ReactElement) => {
    CursorPopupManager.open(this._popupId, promptElement, CursorInformation.cursorPosition, this._offset, this._relativePosition, { shadow: true });
    CursorInformation.onCursorUpdatedEvent.addListener(this._handleCursorUpdated);
  }

  private _endCursorPopup = () => {
    CursorPopupManager.close(this._popupId, false, true);
    CursorInformation.onCursorUpdatedEvent.removeListener(this._handleCursorUpdated);
  }

  private _handleCursorUpdated = (args: CursorUpdatedEventArgs) => {
    setImmediate(() => {
      CursorPopupManager.updatePosition(args.newPt, this._offset, this._relativePosition);
    });
  }

}
