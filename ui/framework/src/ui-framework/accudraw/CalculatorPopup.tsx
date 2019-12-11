/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module AccuDraw */

import * as React from "react";

import { OnNumberCommitFunc, OnCancelFunc } from "@bentley/ui-abstract";
import { Icon, DivWithOutsideClick, Size, SizeProps } from "@bentley/ui-core";

import { PositionPopup, PositionPopupContent } from "../popup/PositionPopup";
import { PopupManager, PopupPropsBase } from "../popup/PopupManager";
import { Calculator } from "./Calculator";

/** @alpha */
export interface CalculatorPopupProps extends PopupPropsBase {
  initialValue: number;
  resultIcon: string;
  onOk: OnNumberCommitFunc;
  onCancel: OnCancelFunc;
}

/** @internal */
interface CalculatorPopupState {
  size: Size;
}

/** Popup component for Calculator
 * @alpha
 */
export class CalculatorPopup extends React.PureComponent<CalculatorPopupProps, CalculatorPopupState> {
  /** @internal */
  public readonly state = {
    size: new Size(-1, -1),
  };

  private _onSizeKnown = (newSize: SizeProps) => {
    // istanbul ignore else
    if (!this.state.size.equals(newSize))
      this.setState({ size: Size.create(newSize) });
  }

  /** @internal */
  public render() {
    const point = PopupManager.getPopupPosition(this.props.el, this.props.pt, this.props.offset, this.state.size);

    return (
      <PositionPopup key={this.props.id}
        point={point}
        className="uifw-calculator-host"
        onSizeKnown={this._onSizeKnown}
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
