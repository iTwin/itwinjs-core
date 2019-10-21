/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { OnNumberCommitFunc, OnCancelFunc } from "@bentley/ui-abstract";
import { Icon, DivWithOutsideClick } from "@bentley/ui-core";

import { PositionPopup, PositionPopupContent } from "./PositionPopup";
import { PopupManager, PopupPropsBase } from "./PopupManager";
import { Calculator } from "../accudraw/Calculator";

/** @alpha */
export interface CalculatorPopupProps extends PopupPropsBase {
  initialValue: number;
  resultIcon: string;
  onOk: OnNumberCommitFunc;
  onCancel: OnCancelFunc;
}

/** Popup component for Calculator
 * @alpha
 */
export class CalculatorPopup extends React.PureComponent<CalculatorPopupProps> {

  public render() {
    const point = PopupManager.getPopupPosition(this.props.el, this.props.pt, this.props.offset, this.props.size);

    return (
      <PositionPopup key={this.props.id}
        point={point}
        className="uifw-calculator-host"
        onSizeKnown={this.props.onSizeKnown}
      >
        <DivWithOutsideClick onOutsideClick={this.props.onCancel}>
          <PositionPopupContent>
            <Calculator
              initialValue={this.props.initialValue}
              resultIcon={<Icon iconSpec={this.props.resultIcon} />}
              onOk={this.props.onOk}
              onCancel={this.props.onCancel} />
          </PositionPopupContent>
        </DivWithOutsideClick>
      </PositionPopup>
    );
  }

}
