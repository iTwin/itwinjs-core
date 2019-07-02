/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { ReactNumericInput, ReactNumericInputProps } from "./ReactNumericInput";

import { CommonProps } from "../../utils/Props";
import { Omit } from "../../utils/typeUtils";

import "./NumericInput.scss";

// cSpell:ignore nostyle

/** @alpha */
export type StepFunctionProp = number | ((direction: string) => number | undefined);

/** @alpha */
export interface NumericInputProps extends Omit<ReactNumericInputProps, "step">, CommonProps {
  step?: StepFunctionProp;
}

/** Default properties of [[NumericInput]] component.
 * @alpha
 */
export type NumericInputDefaultProps = Pick<NumericInputProps, "strict">;

/** @alpha */
export class NumericInput extends React.Component<NumericInputProps> {

  /** @internal */
  public static readonly defaultProps: NumericInputDefaultProps = {
    strict: true,
  };

  private _step = (_component: ReactNumericInput, direction: string): number | undefined => {
    let result: number | undefined;
    if (this.props.step !== undefined) {
      if (typeof this.props.step === "number")
        result = this.props.step;
      else
        result = this.props.step(direction);
    }
    return result;
  }

  public render() {
    return (
      <span className={classnames("core-numeric-input", this.props.className)} style={this.props.style} data-testid="core-numeric-input" >
        <ReactNumericInput
          componentClass={this.props.componentClass}
          defaultValue={this.props.defaultValue}
          format={this.props.format}
          max={this.props.max}
          maxLength={this.props.maxLength}
          min={this.props.min}
          mobile={this.props.mobile}
          noValidate={this.props.noValidate}
          onBlur={this.props.onBlur}
          onChange={this.props.onChange}
          onFocus={this.props.onFocus}
          onInput={this.props.onInput}
          onInvalid={this.props.onInvalid}
          onKeyDown={this.props.onKeyDown}
          onSelect={this.props.onSelect}
          onValid={this.props.onValid}
          parse={this.props.parse}
          precision={this.props.precision}
          snap={this.props.snap}
          step={this._step}
          strict={this.props.strict}
          value={this.props.value}
        />
      </span>
    );
  }
}
