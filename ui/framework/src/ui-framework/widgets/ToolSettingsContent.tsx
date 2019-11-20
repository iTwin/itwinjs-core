/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { WidgetContent, HorizontalAnchor, ToolSettingsWidgetMode } from "@bentley/ui-ninezone";
import "./ToolSettingsContent.scss";

/** @internal */
interface ToolSettingsContentProps {
  anchor: HorizontalAnchor;
  mode: ToolSettingsWidgetMode;
}

/**  @internal */
export class ToolSettingsContent extends React.PureComponent<ToolSettingsContentProps> {
  public render(): React.ReactNode | undefined {
    const className = classnames(
      "uifw-tool-settings-content",
      this.props.mode === ToolSettingsWidgetMode.TitleBar && "uifw-title-bar",
      this.props.mode === ToolSettingsWidgetMode.Tab && "uifw-tab",
    );
    return (
      <WidgetContent
        anchor={this.props.anchor}
        className={className}
        content={this.props.children}
      />
    );
  }
}
