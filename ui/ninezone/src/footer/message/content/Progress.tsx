/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../../utilities/Props";
import Css from "../../../utilities/Css";
import withTheme, { WithThemeProps } from "../../../theme/WithTheme";
import { Status, StatusHelpers } from "./status/Status";
import "./Progress.scss";

/** Properties of [[Progress]] component. */
export interface ProgressProps extends CommonProps, NoChildrenProps {
  /** Progress of this progress bar. Range from 0 to 100 (percentage). */
  progress: number;
  /** Progress bar status. */
  status: Status;
}

// tslint:disable-next-line:variable-name
const ProgressComponent: React.StatelessComponent<ProgressProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-progress",
    StatusHelpers.getCssClassName(props.status),
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-progress">
        <div
          className="nz-progress-bar"
          style={{
            width: Css.toPercentage(props.progress),
          }}
        >
          <div className="nz-progress-bar-tip"></div>
        </div>
      </div>
    </div>
  );
};

/** Progress bar component used in status message. I.e. [[MessageLayout]] */
// tslint:disable-next-line:variable-name
export const Progress: React.ComponentClass<ProgressProps & WithThemeProps> = withTheme(ProgressComponent);

export default Progress;
