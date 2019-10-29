/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import { Button, ButtonType, Toggle } from "@bentley/ui-core";
import { TitleBar, Dialog, FooterPopup } from "@bentley/ui-ninezone";
import { ViewClipDecorationProvider, IModelApp, ViewClipDecoration, ViewClipClearTool, Viewport, ClipEventType } from "@bentley/imodeljs-frontend";
import { Indicator } from "./Indicator";
import * as React from "react";
import "./SectionsField.scss";

/** Widget for showing section extra tools for clearing and showing manipulators
 * @beta
 */
// TODO: Add testing as soon as possible - needed for Risk Management Plugin frontstage
// istanbul ignore next
export class SectionsStatusField extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.state = {
      opened: false,
      manipulatorsShown: false,
      target: null,
      toggleDisabled: true,
    };
  }

  /** Listen for view clip creation */
  public componentDidMount() {
    ViewClipDecorationProvider.create().onActiveClipChanged.addListener(this._handleClipChanged);

    if (IModelApp.viewManager.selectedView) {
      const toggleDisabled = undefined === IModelApp.viewManager.selectedView!.view.getViewClip();
      this.setState({
        ...this.state,
        toggleDisabled,
      });
    }
  }

  /** Clean-up */
  public componentWillUnmount() {
    ViewClipDecorationProvider.create().onActiveClipChanged.removeListener(this._handleClipChanged);
  }

  /** Handle clip creation to enable/disable the toggle */
  private _handleClipChanged = (_viewport: Viewport, eventType: ClipEventType, _provider: ViewClipDecorationProvider) => {
    const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView!) !== undefined;
    this.setState({
      ...this.state,
      manipulatorsShown,
      toggleDisabled: eventType === ClipEventType.Clear,
    });
  }

  /** Handle opening/closing the dialog */
  public handleClick() {
    const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView!) !== undefined;
    const toggleDisabled = undefined === IModelApp.viewManager.selectedView!.view.getViewClip();
    this.setState({
      ...this.state,
      opened: !this.state.opened,
      manipulatorsShown,
      toggleDisabled,
    });
  }

  /** Clears sections */
  public handleClear() {
    IModelApp.tools.run(ViewClipClearTool.toolId, ViewClipDecorationProvider.create());
    const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView!) !== undefined;
    const toggleDisabled = undefined === IModelApp.viewManager.selectedView!.view.getViewClip();
    this.setState({ ...this.state, manipulatorsShown, toggleDisabled });
  }

  /** Shows/hides the section manipulators */
  public handleShowHideManipulators(_checked: boolean) {
    ViewClipDecorationProvider.create().toggleDecoration(IModelApp.viewManager.selectedView!);
    const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView!) !== undefined;
    this.setState({ ...this.state, manipulatorsShown });
  }

  /** Render buttons for clear and show/hide manipulators */
  public renderContents() {
    return (
      <div className="uifw-sections-footer-contents">
        <Button buttonType={ButtonType.Hollow} onClick={this.handleClear.bind(this)}>{IModelApp.i18n.translate("UiFramework:tools.sectionClear")}</Button>
        <div className="uifw-uifw-sections-toggle-container">
          <div className="uifw-sections-label">{IModelApp.i18n.translate("UiFramework:tools.sectionShowHandles")}</div>
          <Toggle className="uifw-sections-toggle" disabled={this.state.toggleDisabled} onChange={this.handleShowHideManipulators.bind(this)} isOn={!this.state.toggleDisabled && this.state.manipulatorsShown} showCheckmark={false} />
        </div>
      </div>
    );
  }

  public render() {
    return (
      <>
        <div ref={this._handleTargetRef} title={IModelApp.i18n.translate("UiFramework:tools.sectionTools")}>
          <Indicator
            iconName="icon-section-tool"
            onClick={this.handleClick.bind(this)}
            opened={this.state.opened}></Indicator>
        </div>
        <FooterPopup
          target={this.state.target}
          onClose={() => { this.setState({ ...this.state, opened: false }); }}
          isOpen={this.state.opened}>
          <Dialog
            titleBar={
              <TitleBar title={IModelApp.i18n.translate("UiFramework:tools.sectionTools")}>
              </TitleBar>
            }>
            {this.renderContents()}
          </Dialog>
        </FooterPopup>
      </>
    );
  }

  private _handleTargetRef = (target: HTMLElement | null) => {
    this.setState({ target });
  }
}
