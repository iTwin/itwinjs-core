/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./ViewAttributes.scss";
import * as React from "react";
import { ViewFlagProps, ViewFlags } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { Checkbox } from "@itwin/itwinui-react";
import { UiFramework } from "../UiFramework";
import { Indicator } from "./Indicator";
import { StatusFieldProps } from "./StatusFieldProps";
import { StatusBarDialog } from "../statusbar/dialog/Dialog";

interface ViewAttributesStatusFieldState {
  viewFlags: ViewFlagProps;
  cameraOn: boolean;
  target: HTMLElement | null;
}

/** Widget for showing Checkboxes for View Attributes
 * @beta
 */
export class ViewAttributesStatusField extends React.Component<StatusFieldProps, ViewAttributesStatusFieldState> {
  private _className: string;
  private _title = UiFramework.translate("listTools.viewAttributes");

  constructor(props: StatusFieldProps) {
    super(props);

    this.state = {
      cameraOn: false,
      viewFlags: {},
      target: null,
    };

    this._className = this.constructor.name;
  }

  public override componentDidMount() {
    this.updateState();
  }

  // istanbul ignore next
  private updateState() {
    if (IModelApp.viewManager.selectedView) {
      const viewFlags: ViewFlagProps = { ...IModelApp.viewManager.selectedView.view.viewFlags.toJSON() };
      const cameraOn = IModelApp.viewManager.selectedView.isCameraOn;

      this.setState({
        viewFlags,
        cameraOn,
      });
    }
  }

  // istanbul ignore next
  private _handleViewFlagClick = (flagName: string) => {
    if (IModelApp.viewManager.selectedView) {
      const props: ViewFlagProps = IModelApp.viewManager.selectedView.viewFlags.toJSON();
      (props as any)[flagName] = (props as any)[flagName] === undefined ? true : !(props as any)[flagName];
      const viewFlags = ViewFlags.fromJSON(props);
      IModelApp.viewManager.selectedView.viewFlags = viewFlags;
      this.updateState();
    }
  };

  private _handleToggleCamera = async () => {
    await IModelApp.tools.run("View.ToggleCamera", IModelApp.viewManager.selectedView);
    this.updateState();
  };

  // istanbul ignore next
  private stylizeName(name: string) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
    name = name.replace(/([A-Z])/g, " $1").trim();
    return name;
  }

  private getViewFlagItem(flagName: string, value: boolean, labelKey?: string) {
    return <Checkbox key={flagName} label={labelKey ? IModelApp.localization.getLocalizedString(labelKey) : /* istanbul ignore next */ this.stylizeName(flagName)} onClick={() => this._handleViewFlagClick(flagName)} defaultChecked={value} />;
  }

  private getFlagState(flagName: string) {
    return this.state.viewFlags.hasOwnProperty(flagName) ? /* istanbul ignore next */ (this.state.viewFlags as any)[flagName] : false;
  }

  private getToggleCameraItem() {
    return <Checkbox key={"toggleCamera"} label={IModelApp.localization.getLocalizedString("UiFramework:listTools.camera")} onClick={this._handleToggleCamera} defaultChecked={this.state.cameraOn} />;
  }

  private getViewFlags() {
    const items: React.JSX.Element[] = [];
    items.push(this.getViewFlagItem("acs", this.getFlagState("acs"), "UiFramework:listTools.acs"));
    items.push(this.getToggleCameraItem());
    items.push(this.getViewFlagItem("noConstruct", !this.getFlagState("noConstruct"), "UiFramework:listTools.constructions"));
    items.push(this.getViewFlagItem("hidEdges", this.getFlagState("hidEdges"), "UiFramework:listTools.hidEdges"));
    items.push(this.getViewFlagItem("monochrome", this.getFlagState("monochrome"), "UiFramework:listTools.monochrome"));
    items.push(this.getViewFlagItem("visEdges", this.getFlagState("visEdges"), "UiFramework:listTools.visEdges"));
    items.push(this.getViewFlagItem("ambientOcclusion", this.getFlagState("ambientOcclusion"), "UiFramework:listTools.ambientOcclusion"));
    items.push(this.getViewFlagItem("shadows", this.getFlagState("shadows"), "UiFramework:listTools.shadows"));
    items.push(this.getViewFlagItem("backgroundMap", this.getFlagState("backgroundMap"), "UiFramework:listTools.backgroundMap"));
    return <div className="uifw-view-attributes-contents">{items}</div>;
  }

  public override render() {
    // eslint-disable-next-line deprecation/deprecation
    const isOpen = this.props.openWidget === this._className;
    return (
      <>
        <Indicator // eslint-disable-line deprecation/deprecation
          iconName="icon-window-settings"
          opened={isOpen}
          toolTip={this._title}
          dialog={<StatusBarDialog
            titleBar={
              <StatusBarDialog.TitleBar title={this._title} />
            }>
            {this.getViewFlags()}
          </StatusBarDialog>}
          // eslint-disable-next-line deprecation/deprecation
          isInFooterMode={this.props.isInFooterMode ?? true}
        />
      </>
    );
  }

}
