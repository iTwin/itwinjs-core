/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Message
 */

import "./Progress.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps, NoChildrenProps } from "@itwin/core-react";
import { Css } from "../../utilities/Css";
import type { Status} from "./Status";
import { StatusHelpers } from "./Status";

/** Properties of [[MessageProgress]] component.
 * @internal
 */
export interface ProgressProps extends CommonProps, NoChildrenProps {
  /** Progress of this progress bar. Range from 0 to 100 (percentage). */
  progress: number;
  /** Progress bar status. */
  status: Status;
}

/** Progress bar component used in [[Message]] component.
 * @internal
 */
export class MessageProgress extends React.PureComponent<ProgressProps> {
  public override render() {
    const className = classnames(
      "nz-footer-message-progress",
      StatusHelpers.getCssClassName(this.props.status),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-progress">
          <div
            className="nz-progress-bar"
            style={{
              width: Css.toPercentage(this.props.progress),
            }}
          >
            <div className="nz-progress-bar-tip"></div>
          </div>
        </div>
      </div>
    );
  }
}
