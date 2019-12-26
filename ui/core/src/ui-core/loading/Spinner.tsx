/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Loading */

import * as React from "react";

import "./Spinner.scss";

// cspell:ignore xlarge

/** Size for [[Spinner]] component
 * @public
 */
export enum SpinnerSize {
  Small,
  Medium,
  Large,
  XLarge,
}

/** Properties for [[Spinner]] component
 * @public
 */
export interface SpinnerProps {
  /** Size of spinner */
  size?: SpinnerSize;
  /** CSS class for size of spinner */
  sizeClass?: string;
}

/**
 * A spinner component.
 * @public
 */
export class Spinner extends React.PureComponent<SpinnerProps> {

  public render() {
    let sizeClass: string;

    if (this.props.sizeClass)
      sizeClass = this.props.sizeClass;
    else {
      switch (this.props.size) {
        case SpinnerSize.Small:
          sizeClass = "core-spinner-small";
          break;
        case SpinnerSize.Large:
          sizeClass = "core-spinner-large";
          break;
        case SpinnerSize.XLarge:
          sizeClass = "core-spinner-xlarge";
          break;
        case SpinnerSize.Medium:
        default:
          sizeClass = "core-spinner-medium";
          break;
      }
    }

    return (
      <div className={sizeClass} />
    );
  }
}
