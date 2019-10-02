/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { TitleBar, FooterPopup, Dialog } from "@bentley/ui-ninezone";
import { Checkbox } from "@bentley/ui-core";
import { ViewFlagProps, ViewFlags } from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Indicator } from "./Indicator";
import * as React from "react";
import "./SectionsField.scss";  // TODO - separate if necessary

interface ViewAttributesStatusFieldState {
  opened: boolean;
  viewFlags: ViewFlagProps;
  cameraOn: boolean;
}

/** Widget for showing section extra tools for clearing and showing manipulators
 * @beta
 */
// TODO: Add testing as soon as possible - needed for Risk Management Plugin frontstage
// istanbul ignore next
export class ViewAttributesStatusField extends React.Component<any, ViewAttributesStatusFieldState> {
  private _target = React.createRef<HTMLDivElement>();

  constructor(props: any) {
    super(props);

    this.state = {
      cameraOn: false,
      opened: false,
      viewFlags: {},
    };
  }

  public componentDidMount() {
    this.updateState();
  }

  /** Handle opening/closing the dialog */
  public handleClick() {
    this.updateState(true);
  }

  public updateState(toggleOpened?: boolean) {
    if (IModelApp.viewManager.selectedView) {
      const viewFlags: ViewFlagProps = { ...IModelApp.viewManager.selectedView.view.viewFlags.toJSON() };
      const cameraOn = IModelApp.viewManager.selectedView.isCameraOn;
      this.setState({
        ...this.state,
        viewFlags,
        cameraOn,
        opened: toggleOpened ? !this.state.opened : this.state.opened,
      });
    }
  }

  public handleViewFlagClick = (flagName: string) => {
    const props: ViewFlagProps = IModelApp.viewManager.selectedView!.viewFlags.toJSON();
    (props as any)[flagName] = (props as any)[flagName] === undefined ? true : !(props as any)[flagName];
    const viewFlags = ViewFlags.fromJSON(props);
    IModelApp.viewManager.selectedView!.viewFlags = viewFlags;
    IModelApp.viewManager.selectedView!.invalidateRenderPlan();
    this.updateState();
  }

  private _handleToggleCamera = () => {
    IModelApp.tools.run("View.ToggleCamera", IModelApp.viewManager.selectedView);
    this.updateState();
  }

  private stylizeName(name: string) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
    name = name.replace(/([A-Z])/g, " $1").trim();
    return name;
  }

  private getViewFlagItem(flagName: string, value: boolean, labelKey?: string) {
    return <Checkbox key={flagName} label={labelKey ? IModelApp.i18n.translate(labelKey) : this.stylizeName(flagName)} onClick={() => this.handleViewFlagClick(flagName)} defaultChecked={value} />;
  }

  private getFlagState(flagName: string) {
    return this.state.viewFlags!.hasOwnProperty(flagName) ? (this.state.viewFlags as any)[flagName] : false;
  }

  private getToggleCameraItem() {
    return <Checkbox key={"toggleCamera"} label={IModelApp.i18n.translate("UiFramework:listTools.camera")} onClick={() => this._handleToggleCamera()} defaultChecked={this.state.cameraOn} />;
  }

  private getViewFlags() {
    const items: JSX.Element[] = [];
    items.push(this.getViewFlagItem("acs", this.getFlagState("acs"), "UiFramework:listTools.acs"));
    items.push(this.getToggleCameraItem());
    items.push(this.getViewFlagItem("noConstruct", !this.getFlagState("noConstruct"), "UiFramework:listTools.constructions"));
    items.push(this.getViewFlagItem("hidEdges", this.getFlagState("hidEdges"), "UiFramework:listTools.hidEdges"));
    items.push(this.getViewFlagItem("monochrome", this.getFlagState("monochrome"), "UiFramework:listTools.monochrome"));
    items.push(this.getViewFlagItem("visEdges", this.getFlagState("visEdges"), "UiFramework:listTools.visEdges"));
    items.push(this.getViewFlagItem("ambientOcclusion", this.getFlagState("ambientOcclusion"), "UiFramework:listTools.ambientOcclusion"));
    items.push(this.getViewFlagItem("shadows", this.getFlagState("shadows"), "UiFramework:listTools.shadows"));
    return <div className="uifw-view-attributes-contents">{items}</div>;
  }

  public render() {
    return (
      <>
        <div ref={this._target} title={IModelApp.i18n.translate("UiFramework:listTools.viewAttributes")}>
          <Indicator
            iconName="icon-window-settings"
            onClick={this.handleClick.bind(this)}
            opened={this.state.opened}></Indicator>
        </div>
        <FooterPopup
          target={this._target}
          onClose={() => { this.setState({ ...this.state, opened: false }); }}
          isOpen={this.state.opened}>
          <Dialog
            titleBar={
              <TitleBar title={IModelApp.i18n.translate("UiFramework:listTools.viewAttributes")}>
              </TitleBar>
            }>
            {this.getViewFlags()}
          </Dialog>
        </FooterPopup>
      </>
    );
  }
}
