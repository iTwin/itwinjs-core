/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as React from "react";
import { CSSProperties } from "react";
import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";

import ToolSettingsWidget from "@bentley/ui-ninezone/lib/widget/ToolSettings";
import ToolSettingsTab from "@bentley/ui-ninezone/lib/widget/tool-settings/Tab";
import ToolSettings from "@bentley/ui-ninezone/lib/widget/tool-settings/Settings";
import CommonProps from "@bentley/ui-ninezone/lib/utilities/Props";
import NZ_Zone from "@bentley/ui-ninezone/lib/zones/Zone";
import { TabIcon } from "@bentley/ui-ninezone/lib/widget/TabIcon";

import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";

/** State for the ToolSettingsZone content.
 */
export enum ToolSettingsZoneContent {
  Closed,
  ToolSettings,
}

/** State for the ToolSettingsZone.
 */
export interface ToolSettingsZoneState {
  toolSettingsZoneContent: ToolSettingsZoneContent;
  isPopoverOpen: boolean;
  isNestedPopoverOpen: boolean;
  toolId: string;
}

/** Properties for the [[ToolSettingsZone]] React component.
 */
export interface ToolSettingsZoneProps extends CommonProps {
  bounds: RectangleProps;
}

/** Tool Settings Zone React component.
 */
export class ToolSettingsZone extends React.Component<ToolSettingsZoneProps, ToolSettingsZoneState> {

  /** @hidden */
  public readonly state: Readonly<ToolSettingsZoneState> = {
    toolSettingsZoneContent: ToolSettingsZoneContent.Closed,
    isPopoverOpen: false,
    isNestedPopoverOpen: false,
    toolId: "",
  };

  constructor(props: ToolSettingsZoneProps) {
    super(props);
  }

  public componentDidMount(): void {
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
    this.setState((_prevState, _props) => ({ toolId: args.toolId }));
  }

  public render(): React.ReactNode {
    if (FrontstageManager.activeToolAssistanceNode || FrontstageManager.activeToolSettingsNode) {
      const divStyle: CSSProperties = {
        display: "grid",
        justifyItems: "center",
        gridAutoRows: "min-content auto",
      };

      return (
        <NZ_Zone
          bounds={this.props.bounds}
        >
          <div style={divStyle} >
            {this.getToolSettingsWidget()}
          </div>
        </NZ_Zone>
      );
    }

    return null;
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

  private getToolSettingsWidget() {
    const tab = (
      <ToolSettingsTab
        onClick={this._processClick}
        isActive={this.state.toolSettingsZoneContent === ToolSettingsZoneContent.ToolSettings}
      >
        {this.getToolSettingsButton()}
        {/*this.getToolAssistanceButton()*/}
      </ToolSettingsTab>
    );
    switch (this.state.toolSettingsZoneContent) {
      case ToolSettingsZoneContent.ToolSettings: {
        if (FrontstageManager.activeToolSettingsNode) {
          const settingsStyle: CSSProperties = {
            borderWidth: "thin",
            borderStyle: "solid",
            borderRadius: "3px",
            paddingLeft: "10px",
            paddingRight: "10px",
          };

          return (
            <ToolSettingsWidget
              tab={tab}
              content={
                <ToolSettings style={settingsStyle} >
                  {FrontstageManager.activeToolSettingsNode}
                </ToolSettings>
              }
            />
          );
        }
        break;
      }
      case ToolSettingsZoneContent.Closed: {
        return (
          <ToolSettingsWidget
            tab={tab}
          />
        );
      }
    }

    return undefined;
  }

  // private getToolAssistanceButton() {
  //   if (FrontstageManager.activeToolAssistanceNode) {
  //     return (
  //       <ToolbarIcon
  //         key="1"
  //         isActive={this.state.toolSettingsZoneContent === ToolSettingsZoneContent.ToolAssistance}
  //         onClick={
  //           () => {
  //             this.setState((prevState) => {
  //               let toolSettingsZoneContent = ToolSettingsZoneContent.Closed;

  //               if (prevState.toolSettingsZoneContent === ToolSettingsZoneContent.Closed ||
  //                 prevState.toolSettingsZoneContent === ToolSettingsZoneContent.ToolSettings)
  //                 toolSettingsZoneContent = ToolSettingsZoneContent.ToolAssistance;

  //               return {
  //                 toolSettingsZoneContent,
  //               };
  //             });
  //           }
  //         }
  //       >
  //         <i className="icon icon-help" />
  //       </ToolbarIcon>
  //     );
  //   }

  //   return null;
  // }

  private getToolSettingsButton() {
    if (FrontstageManager.activeToolSettingsNode) {
      return (
        <TabIcon iconSpec="icon-settings" isActive={this.state.toolSettingsZoneContent === ToolSettingsZoneContent.ToolSettings} />
      );
    }

    return null;
  }
}
