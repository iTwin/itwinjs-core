/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Loading
 */

import * as React from "react";
import { LoadingBar } from "./LoadingBar";
import { LoadingSpinner } from "./LoadingSpinner";
import { LoadingStatus } from "./LoadingStatus";
import "./LoadingPrompt.scss";

/** Properties for [[LoadingPrompt]] component
 * @beta
 */
export interface LoadingPromptProps {
  /** Title */
  title: string;
  /** Message displayed below the title (optional) */
  message?: string;
  /** Determine if a loading bar is displayed (isDeterminate=true), otherwise a loading spinner is shown */
  isDeterminate: boolean;
  /** Show current status and percentage. Default is false (not shown) */
  showStatus: boolean;
  /** Show cancel button. Default is false (not shown) */
  showCancel: boolean;
  /** Current loading status text (optional). Only shown if showStatus=true and isDeterminate=true */
  status: string;
  /** Current percentage.  Only used if isDeterminate=true */
  percent: number;
  /** Show percentage at the end of the loading bar (optional). Only shown if isDeterminate=true and showStatus=false */
  showPercentage: boolean;
  /** Function called when Cancel button is clicked. */
  onCancel?: () => void;

  /** Determine if a loading bar is displayed (isDeterminate=true), otherwise a loading spinner is shown
   * @deprecated Use isDeterminate instead
   */
  isDeterministic: boolean;
}

/**
 * A component to display during loading that optionally shows percentage, status text and a cancel button.
 * @beta
 */
export class LoadingPrompt extends React.PureComponent<LoadingPromptProps> {
  public static defaultProps: Partial<LoadingPromptProps> = {
    showPercentage: false,
    showStatus: false,
    showCancel: false,
    isDeterminate: false,
    percent: 0,
    status: "",
  };

  public render() {
    // tslint:disable-next-line: deprecation
    const isDeterminate = this.props.isDeterminate || this.props.isDeterministic;

    return (
      <div className="core-loadingprompt">
        <span className="title">{this.props.title}</span>
        {this.props.message && <span className="message">{this.props.message}</span>}
        {isDeterminate && <LoadingBar style={{ width: "100%" }} percent={this.props.percent} showPercentage={this.props.showPercentage} />}
        {(isDeterminate && this.props.showStatus) &&
          <LoadingStatus style={{ marginTop: ".5em", width: "100%", fontSize: ".75em" }} percent={this.props.percent} message={this.props.status} />}
        {!isDeterminate && <LoadingSpinner />}
        {this.props.showCancel && <button className="loading-prompt-cancel" type="button" onClick={this.props.onCancel}>Cancel</button>}
      </div>
    );
  }
}
