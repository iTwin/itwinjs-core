/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import classnames from "classnames";
import { Id64String } from "@bentley/bentleyjs-core";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { StatusFieldProps, ContentViewManager, FrontstageManager, ContentControlActivatedEventArgs, ContentControl } from "@bentley/ui-framework";
import { Select } from "@bentley/ui-core";
import {
  IModelApp,
  ScreenViewport,
  DisplayStyle3dState,
  DisplayStyle2dState,
  DisplayStyleState,
} from "@bentley/imodeljs-frontend";

import "./DisplayStyleField.scss";

interface DisplayStyleFieldState {
  viewport?: ScreenViewport;
  displayStyles: Map<Id64String, DisplayStyleState>;
  styleEntries: { [key: string]: string };
}

/**
 * Shadow Field React component. This component is designed to be specified in a status bar definition.
 * It is used to enable/disable display of shadows.
 */
export class DisplayStyleField extends React.Component<StatusFieldProps, DisplayStyleFieldState> {
  constructor(props: StatusFieldProps) {
    super(props);

    this.state = { viewport: undefined, displayStyles: new Map<Id64String, DisplayStyleState>(), styleEntries: {} };
  }

  private async setStateFromActiveContent(contentControl?: ContentControl): Promise<void> {
    if (contentControl && contentControl.viewport) {
      const unnamedPrefix = IModelApp.i18n.translate("NavigatorApp:statusFields.unnamedDisplayStyle");
      const displayStyles = new Map<Id64String, DisplayStyleState>();
      const view = contentControl.viewport.view;
      const is3d = view.is3d();
      const sqlName: string = is3d ? DisplayStyle3dState.classFullName : DisplayStyle2dState.classFullName;
      const displayStyleProps = await view.iModel.elements.queryProps({ from: sqlName, where: "IsPrivate=FALSE" });
      const styleEntries: { [key: string]: string } = {};
      let emptyNameSuffix = 0;
      for (const displayStyleProp of displayStyleProps) {
        let name = displayStyleProp.code.value!;
        if (0 === name.length) {
          emptyNameSuffix++;
          name = `${unnamedPrefix}-${emptyNameSuffix}`;
        }
        styleEntries[displayStyleProp.id!] = name;

        let displayStyle: DisplayStyleState;
        if (is3d)
          displayStyle = new DisplayStyle3dState(displayStyleProp, view.iModel);
        else
          displayStyle = new DisplayStyle2dState(displayStyleProp, view.iModel);

        displayStyles.set(displayStyleProp.id!, displayStyle);
      }

      this.setState((_prevState) => (
        {
          viewport: contentControl.viewport,
          displayStyles,
          styleEntries,
        }));
    }
  }

  private _handleContentControlActivatedEvent = (args: ContentControlActivatedEventArgs) => {
    setImmediate(() => this.setStateFromActiveContent(args.activeContentControl));
  }

  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivatedEvent);

    // tslint:disable-next-line: no-floating-promises
    this.setStateFromActiveContent(ContentViewManager.getActiveContentControl());
  }

  public componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivatedEvent);
  }

  private _handleDisplayStyleSelected = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!this.state.viewport)
      return;

    this.state.viewport!.displayStyle = this.state.displayStyles.get(event.target.value)!.clone();
    this.state.viewport!.invalidateScene();
    this.state.viewport!.synchWithView(false);
    this.forceUpdate();
  }

  public render(): React.ReactNode {
    if (!this.state.viewport)
      return null;

    const displayStyleId = this.state.viewport.view.displayStyle.id;

    return (
      <FooterIndicator
        className={classnames("uifw-statusFields-displayStyle", this.props.className)}
        style={this.props.style}
        isInFooterMode={this.props.isInFooterMode}
      >
        <Select options={this.state.styleEntries} value={displayStyleId} onChange={this._handleDisplayStyleSelected}
          title={IModelApp.i18n.translate("NavigatorApp:statusFields.displayStyle")}
          className="uifw-statusFields-displayStyle-selector" />
      </FooterIndicator >
    );
  }
}
