/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { StagePanelType, StagePanelTypeHelpers } from "../../stage-panels/StagePanel";
import { MergeTargetProps } from "./Merge";
import { WidgetTarget } from "./Target";
import "./StagePanel.scss";

/** Properties of [[StagePanel]] component.
 * @beta
 */
export interface StagePanelTargetProps extends MergeTargetProps {
  /** Stage panel type. */
  type: StagePanelType;
}

/** Zone target used to merge widgets to stage panels.
 * @beta
 */
export class StagePanelTarget extends React.PureComponent<StagePanelTargetProps> {
  public render() {
    const { className, ...props } = this.props;
    const targetClassName = classnames("nz-zones-target-stagePanel",
      StagePanelTypeHelpers.getCssClassName(this.props.type),
      className);
    return (
      <WidgetTarget
        className={targetClassName}
        {...props}
      />
    );
  }
}
