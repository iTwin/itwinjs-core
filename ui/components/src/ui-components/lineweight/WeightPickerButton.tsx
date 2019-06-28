/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module LineWeight */

import * as React from "react";
import classnames from "classnames";
import { ColorDef } from "@bentley/imodeljs-common";
import { Popup, Position, CommonProps } from "@bentley/ui-core";
import ReactResizeDetector from "react-resize-detector";
import { LineWeightSwatch } from "./Swatch";
import "./WeightPickerButton.scss";

// cSpell:ignore weightpicker

/** Properties for the [[WeightPickerButton]] React component
 * @beta
 */
export interface WeightPickerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** active weight */
  activeWeight: number;
  /** available weights */
  weights: number[];
  /** color specification */
  colorDef?: ColorDef;
  /** function to run when user selects weight swatch */
  onLineWeightPick?: ((weight: number) => void) | undefined;
  /** Disabled or not */
  disabled?: boolean;
  /** Readonly or not */
  readonly?: boolean;
  /** hide the weight label */
  hideLabel?: boolean;
  /** Title to show at top of DropDown */
  dropDownTitle?: string;
}

/** @internal */
interface WeightPickerState {
  showPopup: boolean;
}

/** WeightPickerButton component
 * @beta
 */
export class WeightPickerButton extends React.PureComponent<WeightPickerProps, WeightPickerState> {
  private _target: HTMLDivElement | null = null;
  private _focusTarget = React.createRef<HTMLButtonElement>();  // weight button that should receive focus after popup is open

  /** @internal */
  constructor(props: WeightPickerProps) {
    super(props);

    this.state = { showPopup: false };
  }

  public setFocus(): void {
    // istanbul ignore else
    if (this._focusTarget.current)
      this._focusTarget.current.focus();
  }

  public static defaultProps = {
    weights: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  };

  private _togglePopup = () => {
    if (this.props.readonly)
      return;
    this.setState({ showPopup: !this.state.showPopup });
  }

  private _onPopupOpened = () => {
  }

  private _closePopup = () => {
    this.setState((_prevState) => ({ showPopup: false }));
  }

  private _handleWeightPicked = (weight: number) => {
    this._closePopup();
    if (this.props.onLineWeightPick)
      this.props.onLineWeightPick(weight);
  }

  public componentDidMount() {
    // tslint:disable-next-line: no-console
    // console.log(`WeightPickerButton.componentDidMount focusRef=${this._focusTarget && this._focusTarget.current ? "set" : "unset"}`);
  }

  private buildIdForWeight(weight: number): string {
    return `ui-core-lineweight-${weight}`;
  }

  private _handleKeyDown = (event: React.KeyboardEvent<any>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const weightButton = document.activeElement as HTMLElement;
      // istanbul ignore else
      if (weightButton.tagName === "BUTTON") {
        try {
          const values = weightButton.id.split("-");
          // istanbul ignore else
          if (values.length) {
            const weight = parseInt(values[values.length - 1], 10);
            // istanbul ignore else
            if (!isNaN(weight)) {
              // istanbul ignore else
              if (this.props.onLineWeightPick)
                this.props.onLineWeightPick(weight);
            }
          }
        } catch { }
      }
      this._closePopup();
    }
  }

  private renderPopup(title: string | undefined) {
    return (
      <div className="components-weightpicker-popup-container">
        {title && <h4>{title}</h4>}
        <ul data-testid="components-weightpicker-popup-lines" className="components-weightpicker-popup-lines" onKeyDown={this._handleKeyDown}>
          {this.props.weights.map((weight, index) => {
            const classNames = classnames(
              "components-weightpicker-swatch",
              weight === this.props.activeWeight && "active",
            );
            return (<LineWeightSwatch
              className={classNames}
              key={index}
              colorDef={this.props.colorDef}
              id={this.buildIdForWeight(weight)}
              hideLabel={this.props.hideLabel}
              onClick={this._handleWeightPicked.bind(this, weight)}
              weight={weight} />);
          })
          }
        </ul>
      </div>
    );
  }

  private _setTarget = (el: any) => {
    this._target = el;
  }

  /** @internal */
  public render() {
    const buttonClassNames = classnames(
      "components-weightpicker-button",
      this.props.className,
    );

    return (
      <ReactResizeDetector handleWidth>
        {(width: number) =>
          <>
            <div ref={this._setTarget} >
              <LineWeightSwatch
                data-testid="components-weightpicker-button"
                className={buttonClassNames}
                weight={this.props.activeWeight}
                colorDef={this.props.colorDef}
                readonly={this.props.readonly}
                disabled={this.props.disabled}
                hideLabel={this.props.hideLabel}
                aria-haspopup="listbox"
                aria-expanded={this.state.showPopup}
                onClick={this._togglePopup} />
            </div>
            <Popup
              className="components-weightpicker-popup"
              style={{ width: `${width}px` }}
              isOpen={this.state.showPopup}
              position={Position.Bottom}
              onClose={this._closePopup}
              onOpen={this._onPopupOpened}
              focusTarget={`#${this.buildIdForWeight(this.props.activeWeight)}`}
              moveFocus={true}
              target={this._target} >
              {this.renderPopup(this.props.dropDownTitle)}
            </Popup>
          </>
        }
      </ReactResizeDetector>
    );
  }
}
