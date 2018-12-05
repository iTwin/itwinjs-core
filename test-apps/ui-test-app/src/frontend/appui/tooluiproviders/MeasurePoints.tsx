/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ToolButton, FrontstageManager, ConfigurableUiControlType, ContentControlActivatedEventArgs } from "@bentley/ui-framework";
import { BeDuration } from "@bentley/bentleyjs-core";
// import { constants } from "perf_hooks";

export interface ToolState {
  isVisible: boolean;
  isEnabled: boolean;
}

/** Class that provides the Measure by Points ToolBar Button */
export class MeasureByPointsButton extends React.Component<{}, ToolState> {
  /** @hidden */
  public readonly state: ToolState = { isVisible: true, isEnabled: true };

  public static executeCommand = () => {
    // first load the plugin
    IModelApp.tools.run("Plugin", ["MeasurePoints.js"]);
    // then wait one second and run the newly installed Plugin tool.
    BeDuration.wait(1000).then(() => { IModelApp.tools.run("Measure.Points"); })
    .catch();
  }

  private _handleContentControlActivatedEvent = (args: ContentControlActivatedEventArgs) => {
    setImmediate(() => {
      if (args.activeContentControl !== args.oldContentControl) {
        if (args.activeContentControl && ConfigurableUiControlType.Viewport === args.activeContentControl.getType()) {
          this.setState((_prevState) => ({ isEnabled: true }));
        } else {
          this.setState((_prevState) => ({ isEnabled: false }));
        }
      }
    });
  }

  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivatedEvent);
  }

  public render() {
    return (
      <ToolButton toolId="Measure.Points" iconSpec="icon-measure-distance" execute={MeasureByPointsButton.executeCommand} isEnabled={this.state.isEnabled} isVisible={this.state.isVisible} />
    );
  }
}
