/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { Orientation } from "@bentley/ui-core";

import "./NonPrimitiveValueRenderer.scss";
import { PropertyRecord } from "../../../Record";
import { PropertyPopupState, PropertyDialogState } from "../../../ValueRendererManager";

/** Properties for [[TableArrayValueRenderer]] and [[TableStructValueRenderer]] React component */
export interface TableSpecificValueRendererProps extends SharedTableNonPrimitiveValueRendererProps {
  /** Property record */
  propertyRecord: PropertyRecord;
  /** Orientation of the rendered property */
  orientation: Orientation;
}

/** Shared properties between table non-primitive value renderers */
export interface SharedTableNonPrimitiveValueRendererProps {
  /** Callback to request for a Popup to be shown. */
  onPopupShow?: (popupState: PropertyPopupState) => void;
  /** Callback to request for a Popup to be hidden. */
  onPopupHide?: () => void;
  /** Callback to request for dialog to be opened. */
  onDialogOpen?: (dialogState: PropertyDialogState) => void;
}

/** Propertiess for [[TableNonPrimitiveValueRenderer]] React component */
export interface TableNonPrimitiveValueRendererProps extends SharedTableNonPrimitiveValueRendererProps {
  /** Title of the dialog that shows property in more detail. */
  dialogTitle: string;
  /** Contents of the dialog. Should be the property record shown in more detail. */
  dialogContents: React.ReactNode;
  /** Text that will be rendered in the table cell, in other words - Property value */
  buttonLabel: string;
}

/**
 * A React component that renders non primitive values as a button with text.
 * When clicked, a dialog appears that shows the value in greater detail.
 */
export class TableNonPrimitiveValueRenderer extends React.PureComponent<TableNonPrimitiveValueRendererProps> {
  private _buttonRef = React.createRef<HTMLButtonElement>();

  private _onClick = () => {
    if (!this.props.onDialogOpen)
      return;

    const dialogState: PropertyDialogState = { content: this.props.dialogContents, title: this.props.dialogTitle };

    this.props.onDialogOpen(dialogState);
  }

  private _showTooltip = () => {
    if (!this.props.onPopupShow)
      return;

    const buttonElement = this._buttonRef.current;

    if (!buttonElement)
      return;

    const buttonBox = buttonElement.getBoundingClientRect();

    const popupState: PropertyPopupState = {
      fixedPosition: {
        top: buttonBox.top - 10,
        left: buttonBox.left + buttonBox.width / 2,
      },
      content:
        <span className="components-table-value-popup">
          {`View ${this.props.buttonLabel} in more detail.`}
        </span>,
    };
    this.props.onPopupShow(popupState);
  }

  private _hideTooltip = () => {
    if (this.props.onPopupHide)
      this.props.onPopupHide();
  }

  public render() {
    return (
      <>
        <button
          ref={this._buttonRef}
          className="components-table-value-button"
          onClick={this._onClick}
          onMouseEnter={this._showTooltip}
          onMouseLeave={this._hideTooltip}
        >
          <span>
            {this.props.buttonLabel}
          </span>
        </button>
      </>
    );
  }
}
