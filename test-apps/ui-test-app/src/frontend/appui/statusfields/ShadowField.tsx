/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./ShadowField.scss";
import classnames from "classnames";
import * as React from "react";
import { RenderMode } from "@itwin/core-common";
import { ScreenViewport } from "@itwin/core-frontend";
import { ContentControl, ContentControlActivatedEventArgs, ContentViewManager, FrontstageManager, StatusBarIndicator } from "@itwin/appui-react";
import { Checkbox } from "@itwin/itwinui-react";
import { CommonProps } from "@itwin/core-react";

// cspell:ignore statusfield

interface ShadowFieldState {
  viewId: string;            // The id used to save the current state of the splitter
  viewport?: ScreenViewport;
}

/**
 * Shadow Field React component. This component is designed to be specified in a status bar definition.
 * It is used to enable/disable display of shadows.
 */
export class ShadowField extends React.Component<CommonProps, ShadowFieldState> {

  constructor(props: CommonProps) {
    super(props);

    this.state = { viewId: "" };
  }

  private setStateFromActiveContent(contentControl?: ContentControl): void {
    if (contentControl && contentControl.viewport) {
      this.setState((_prevState) => ({ viewId: contentControl.viewport!.view.id, viewport: contentControl.viewport }));
    } else {
      this.setState((_prevState) => ({ viewId: "", viewport: undefined }));
    }
  }

  private _handleContentControlActivatedEvent = (args: ContentControlActivatedEventArgs) => {
    setImmediate(() => this.setStateFromActiveContent(args.activeContentControl));
  };

  public override componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivatedEvent);
    this.setStateFromActiveContent(ContentViewManager.getActiveContentControl());
  }

  public override componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivatedEvent);
  }

  private _onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!this.state.viewport)
      return;

    const target = event.target;
    const enabled = target.checked;
    const vp = this.state.viewport;
    const view = vp.view;
    if (view && view.is3d()) {
      let vf = vp.viewFlags;
      if (vf.shadows !== enabled) {
        vf = vf.with("shadows", enabled);
        if (enabled)
          vf = vf.withRenderMode(RenderMode.SmoothShade); // required for shadows.

        vp.viewFlags = vf;
        vp.synchWithView();
        this.forceUpdate();
      }
    }
  };

  public override render(): React.ReactNode {
    if (!this.state.viewport)
      return null;

    let isChecked = false;
    let isDisabled = true;

    const cbStyle: React.CSSProperties = {
      backgroundColor: "var(--buic-background-statusbar)",
    };

    const view = this.state.viewport.view;
    if (view && view.is3d()) {
      isDisabled = false;
      isChecked = view.viewFlags.shadows;
    }

    return (
      <StatusBarIndicator
        className={classnames("uifw-statusFields-shadowField", this.props.className)}
        style={this.props.style}
      >
        <Checkbox style={cbStyle} label="Shadows" checked={isChecked} onChange={this._onChange} disabled={isDisabled} className="statusfield-checkbox" />
      </StatusBarIndicator >
    );
  }
}
