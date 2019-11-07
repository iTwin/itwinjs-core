/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import * as classnames from "classnames";

import { Button, ButtonType, Toggle } from "@bentley/ui-core";
import { TitleBar, Dialog, FooterPopup } from "@bentley/ui-ninezone";
import { ViewClipDecorationProvider, IModelApp, ViewClipDecoration, ViewClipClearTool, Viewport, ClipEventType } from "@bentley/imodeljs-frontend";

import { Indicator } from "./Indicator";
import { StatusFieldProps } from "./StatusFieldProps";
import { StatusBarFieldId } from "../statusbar/StatusBarWidgetControl";
import { UiFramework } from "../UiFramework";

import "./SectionsField.scss";

interface SectionsStatusFieldState {
  manipulatorsShown: boolean;
  toggleDisabled: boolean;
  target: HTMLElement | null;
}

/** Widget for showing section extra tools for clearing and showing manipulators
 * @beta
 */
export class SectionsStatusField extends React.Component<StatusFieldProps, SectionsStatusFieldState> {
  private _className: string;
  private _title = UiFramework.translate("tools.sectionTools");

  constructor(props: StatusFieldProps) {
    super(props);

    this.state = {
      manipulatorsShown: false,
      target: null,
      toggleDisabled: true,
    };

    this._className = this.constructor.name;
  }

  /** Listen for view clip creation */
  public componentDidMount() {
    ViewClipDecorationProvider.create().onActiveClipChanged.addListener(this._handleClipChanged);

    if (IModelApp.viewManager.selectedView) {
      const toggleDisabled = undefined === IModelApp.viewManager.selectedView.view.getViewClip();
      this.setState({
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
    if (IModelApp.viewManager.selectedView) {
      const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView) !== undefined;

      this.setState({
        manipulatorsShown,
        toggleDisabled: eventType === ClipEventType.Clear,
      });
    }
  }

  /** Handle opening/closing the dialog */
  private _handleIndicatorClick = () => {
    if (IModelApp.viewManager.selectedView) {
      const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView) !== undefined;
      const toggleDisabled = undefined === IModelApp.viewManager.selectedView.view.getViewClip();

      this.setState({
        manipulatorsShown,
        toggleDisabled,
      });
    }

    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  /** Clears sections */
  private _handleClear = () => {
    IModelApp.tools.run(ViewClipClearTool.toolId, ViewClipDecorationProvider.create());

    if (IModelApp.viewManager.selectedView) {
      const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView) !== undefined;
      const toggleDisabled = undefined === IModelApp.viewManager.selectedView.view.getViewClip();
      this.setState({ manipulatorsShown, toggleDisabled });
    }
  }

  /** Shows/hides the section manipulators */
  private _handleShowHideManipulators = (_checked: boolean) => {
    if (IModelApp.viewManager.selectedView) {
      ViewClipDecorationProvider.create().toggleDecoration(IModelApp.viewManager.selectedView);
      const manipulatorsShown: boolean = ViewClipDecoration.get(IModelApp.viewManager.selectedView) !== undefined;
      this.setState({ manipulatorsShown });
    }
  }

  /** Render buttons for clear and show/hide manipulators */
  private renderContents() {
    return (
      <div className="uifw-sections-footer-contents">
        <Button buttonType={ButtonType.Hollow} onClick={this._handleClear}>{IModelApp.i18n.translate("UiFramework:tools.sectionClear")}</Button>
        <div className="uifw-uifw-sections-toggle-container">
          <div className={classnames("uifw-sections-label", this.state.toggleDisabled && "disabled")}>{IModelApp.i18n.translate("UiFramework:tools.sectionShowHandles")}</div>
          <Toggle className="uifw-sections-toggle" disabled={this.state.toggleDisabled} onChange={this._handleShowHideManipulators.bind(this)} isOn={!this.state.toggleDisabled && this.state.manipulatorsShown} showCheckmark={false} />
        </div>
      </div>
    );
  }

  public render() {
    const isOpen = this.props.openWidget === this._className;

    return (
      <>
        <div ref={this._handleTargetRef} title={this._title}>
          <Indicator
            iconName="icon-section-tool"
            onClick={this._handleIndicatorClick}
            opened={isOpen}
            isInFooterMode={this.props.isInFooterMode}
          />
        </div>
        <FooterPopup
          target={this.state.target}
          onClose={this._handleClose}
          isOpen={isOpen}>
          <Dialog
            titleBar={
              <TitleBar title={this._title} />
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

  private _handleClose = () => {
    this.setOpenWidget(null);
  }

  /** Opens the pop-up window. */
  private setOpenWidget(openWidget: StatusBarFieldId) {
    // istanbul ignore else
    if (this.props.onOpenWidget)
      this.props.onOpenWidget(openWidget);
  }
}
