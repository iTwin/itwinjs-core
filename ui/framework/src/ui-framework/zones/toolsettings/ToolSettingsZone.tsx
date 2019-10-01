/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as React from "react";
import { CommonProps, RectangleProps, PointProps } from "@bentley/ui-core";
import {
  ToolSettings,
  ToolSettingsTab,
  Zone,
  TitleBarButton,
  ResizeHandle,
  ZoneManagerProps,
  ZoneTargetType,
  WidgetZoneId,
} from "@bentley/ui-ninezone";
import { WidgetChangeHandler, TargetChangeHandler } from "../../frontstage/FrontstageComposer";
import { ToolUiManager } from "../toolsettings/ToolUiManager";
import { KeyboardShortcutManager } from "../../keyboardshortcut/KeyboardShortcut";
import { UiFramework } from "../../UiFramework";
import { UiShowHideManager } from "../../utils/UiShowHideManager";
import { SafeAreaContext } from "../../safearea/SafeAreaContext";
import { ZoneTargets } from "../../dragdrop/ZoneTargets";
import { Outline } from "../Outline";
import { getFloatingZoneBounds, getFloatingZoneStyle } from "../FrameworkZone";

/** State for the ToolSettingsZone content.
 */
enum ToolSettingsZoneContent {
  Closed,
  ToolSettings,
}

/** State for the [[ToolSettingsZone]].
 */
interface ToolSettingsZoneState {
  toolSettingsZoneContent: ToolSettingsZoneContent;
}

/** Properties for the [[ToolSettingsZone]] React component.
 * @internal
 */
export interface ToolSettingsZoneProps extends CommonProps {
  dropTarget: ZoneTargetType | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isHidden: boolean;
  isClosed: boolean;
  lastPosition: PointProps | undefined;
  targetChangeHandler: TargetChangeHandler;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  zone: ZoneManagerProps;
}

/** Tool Settings Zone React component.
 * @internal
 */
export class ToolSettingsZone extends React.PureComponent<ToolSettingsZoneProps, ToolSettingsZoneState> {
  private _hiddenVisibility: React.CSSProperties = {
    visibility: "hidden",
  };
  private _settingsSuffix: string;
  private _widget = React.createRef<ToolSettings>();

  /** @internal */
  public readonly state: Readonly<ToolSettingsZoneState>;

  constructor(props: ToolSettingsZoneProps) {
    super(props);

    this._settingsSuffix = UiFramework.translate("general.settings");
    this.state = {
      toolSettingsZoneContent: this.props.isClosed ? ToolSettingsZoneContent.Closed : ToolSettingsZoneContent.ToolSettings,
    };
  }

  public render(): React.ReactNode {
    const bounds = getFloatingZoneBounds(this.props.zone);
    const zIndexStyle = getFloatingZoneStyle(this.props.zone);
    return (
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => (
          <span style={zIndexStyle}>
            <Zone
              bounds={bounds}
              className={this.props.className}
              id={this.props.zone.id}
              isFloating={!!this.props.zone.floating}
              isHidden={this.props.isHidden}
              safeAreaInsets={safeAreaInsets}
              style={this.props.style}
            >
              {this.getToolSettingsWidget()}
            </Zone>
            <Zone
              bounds={this.props.zone.bounds}
              id={this.props.zone.id}
              safeAreaInsets={safeAreaInsets}
            >
              <ZoneTargets
                zoneId={this.props.zone.id}
                dropTarget={this.props.dropTarget}
                targetChangeHandler={this.props.targetChangeHandler}
              />
            </Zone>
            <Outline bounds={this.props.targetedBounds} />
          </span>
        )}
      </SafeAreaContext.Consumer>
    );
  }

  private _processClick = () => {
    this.setState((prevState) => {
      let toolSettingsZoneContent = ToolSettingsZoneContent.Closed;

      if (prevState.toolSettingsZoneContent === ToolSettingsZoneContent.Closed)
        toolSettingsZoneContent = ToolSettingsZoneContent.ToolSettings;
      return {
        toolSettingsZoneContent,
      };
    });
  }

  private _handleKeyDown = (e: React.KeyboardEvent): void => {
    // istanbul ignore else
    if (e.key === "Escape") {
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  private getToolSettingsWidget(): React.ReactNode {
    if (this.state.toolSettingsZoneContent === ToolSettingsZoneContent.Closed) {
      const tooltip = `${ToolUiManager.activeToolLabel} - ${this._settingsSuffix}`;

      return (
        <ToolSettingsTab
          onClick={this._processClick}
          onKeyDown={this._handleKeyDown}
          title={tooltip}
          onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
        >
          <i className="icon icon-settings" />
        </ToolSettingsTab>
      );
    }

    return (
      <ToolSettings
        buttons={
          <div style={this.props.zone.floating && this._hiddenVisibility}>
            <TitleBarButton
              onClick={this._processClick}
              title={UiFramework.translate("general.minimize")}
            >
              <i className={"icon icon-chevron-up"} />
            </TitleBarButton>
          </div>
        }
        contentRef={this.props.getWidgetContentRef(this.props.zone.id)}
        fillZone={this.props.zone.isLayoutChanged && !!this.props.zone.floating}
        lastPosition={this.props.lastPosition}
        onDrag={this.props.zone.allowsMerging ? this.props.widgetChangeHandler.handleTabDrag : undefined}
        onDragEnd={this.props.widgetChangeHandler.handleTabDragEnd}
        onDragStart={this._handleDragStart}
        onResize={this.props.zone.floating && this._handleResize}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
        ref={this._widget}
        title={ToolUiManager.activeToolLabel}
      />
    );
  }

  private _handleDragStart = (initialPosition: PointProps) => {
    if (!this._widget.current)
      return;
    const bounds = this._widget.current.getBounds();
    this.props.widgetChangeHandler.handleTabDragStart(this.props.zone.id, 0, initialPosition, bounds);
  }

  private _handleResize = (resizeBy: number, handle: ResizeHandle) => {
    this.props.widgetChangeHandler.handleResize(this.props.zone.id, resizeBy, handle, 0);
  }
}
