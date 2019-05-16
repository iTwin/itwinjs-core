/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import classnames from "classnames";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { StatusFieldProps, ContentViewManager, FrontstageManager, ContentControlActivatedEventArgs, ContentControl } from "@bentley/ui-framework";
import { Checkbox } from "@bentley/ui-core";
import { ViewFlags, RenderMode } from "@bentley/imodeljs-common";
import { ScreenViewport } from "@bentley/imodeljs-frontend";

import "./ShadowField.scss";

interface ShadowFieldState {
  viewId: string;            // The id used to save the current state of the splitter
  viewport?: ScreenViewport;
}

/**
 * Shadow Field React component. This component is designed to be specified in a status bar definition.
 * It is used to enable/disable display of shadows.
 */
export class ShadowField extends React.Component<StatusFieldProps, ShadowFieldState> {

  constructor(props: StatusFieldProps) {
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
  }

  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivatedEvent);
    this.setStateFromActiveContent(ContentViewManager.getActiveContentControl());
  }

  public componentWillUnmount() {
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
      const scratchViewFlags = new ViewFlags();
      const vf = vp.viewFlags.clone(scratchViewFlags);
      if (vf.shadows !== enabled) {
        vf.shadows = enabled;
        if (enabled)  // also ensure render mode is set to smooth, this is required to display shadows.
          vf.renderMode = RenderMode.SmoothShade;
        vp.viewFlags = vf;
        vp.synchWithView(true);
        this.forceUpdate();
      }
    }
  }

  public render(): React.ReactNode {
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
      <FooterIndicator
        className={classnames("uifw-statusFields-shadowField", this.props.className)}
        style={this.props.style}
        isInFooterMode={this.props.isInFooterMode}
      >
        <Checkbox style={cbStyle} label="Shadows" checked={isChecked} onChange={this._onChange} disabled={isDisabled} inputClassName="statusfield-checkbox" labelClassName="statusfield-checkbox-label" />
      </FooterIndicator >
    );
  }
}
