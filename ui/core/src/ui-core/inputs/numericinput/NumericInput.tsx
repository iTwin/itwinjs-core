/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import "./NumericInput.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utils/Props";
import { Omit } from "../../utils/typeUtils";
import { ReactNumericInput, ReactNumericInputProps } from "./ReactNumericInput";

// cSpell:ignore nostyle

/** Step function prototype for [[NumericInput]] component
 * @beta
 */
export type StepFunctionProp = number | ((direction: string) => number | undefined);

/** Properties for the [[NumericInput]] component
 * @beta
 */
export interface NumericInputProps extends Omit<ReactNumericInputProps, "step">, CommonProps {
  step?: StepFunctionProp;
}

/** Default properties of [[NumericInput]] component.
 * @internal
 */
export type NumericInputDefaultProps = Pick<NumericInputProps, "strict">;

/** Numeric Input React component.
 * @beta
 */
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
  };

  public render() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { step, ...props } = this.props;
    return (
      <span className={classnames("core-numeric-input", this.props.className)} style={this.props.style} data-testid="core-numeric-input" >
        <ReactNumericInput
          {...props}
          step={this._step}
        />
      </span>
    );
  }
}
