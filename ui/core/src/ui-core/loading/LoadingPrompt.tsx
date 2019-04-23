/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Loading */

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
  /** Determine if a loading bar is displayed (isDeterministic=true), otherwise a loading spinner is shown */
  isDeterministic: boolean;
  /** Show current status and percentage. Default is false (not shown) */
  showStatus: boolean;
  /** Show cancel button. Default is false (not shown) */
  showCancel: boolean;
  /** Current loading status text (optional). Only shown if showStatus=true and isDeterministic=true */
  status: string;
  /** Current percentage.  Only used if isDeterministic=true */
  percent: number;
  /** Show percentage at the end of the loading bar (optional). Only shown if isDeterministic=true and showStatus=false */
  showPercentage: boolean;
  /** Function called when Cancel button is clicked. */
  onCancel?: () => void;
}

/**
 * A component to display during loading.
 * @beta
 */
export class LoadingPrompt extends React.PureComponent<LoadingPromptProps> {
  public static defaultProps: Partial<LoadingPromptProps> = {
    showPercentage: false,
    showStatus: false,
    showCancel: false,
    isDeterministic: false,
    percent: 0,
    status: "",
  };

  public render() {
    return (
      <div className="core-loadingprompt">
        <span className="title">{this.props.title}</span>
        <span className="message">{this.props.message}</span>
        {this.props.isDeterministic && <LoadingBar style={{ width: "100%" }} percent={this.props.percent} showPercentage={this.props.showPercentage} />}
        {(this.props.isDeterministic && this.props.showStatus) &&
          <LoadingStatus style={{ marginTop: ".5em", width: "100%", fontSize: ".75em" }} percent={this.props.percent} message={this.props.message} />}
        {!this.props.isDeterministic && <LoadingSpinner />}
        {this.props.showCancel && <button className="loading-prompt-cancel" type="button" onClick={this.props.onCancel}>Cancel</button>}
      </div>
    );
  }
}
