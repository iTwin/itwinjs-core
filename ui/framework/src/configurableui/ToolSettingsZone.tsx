/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as React from "react";
import { CSSProperties } from "react";

import { FrontstageManager } from "./FrontstageManager";
import { ZoneDef } from "./ZoneDef";

import ToolSettingsWidget from "@bentley/ui-ninezone/lib/widget/ToolSettings";
import ToolSettingsTab from "@bentley/ui-ninezone/lib/widget/tool-settings/Tab";
import ToolSettings from "@bentley/ui-ninezone/lib/widget/tool-settings/Settings";
import CommonProps from "@bentley/ui-ninezone/lib/utilities/Props";
import NZ_Zone from "@bentley/ui-ninezone/lib/zones/Zone";
import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";
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
}

/** Props for the ToolSettingsZone React component.
 */
export interface ToolSettingsZoneProps extends CommonProps {
  zoneDef?: ZoneDef;
  bounds: RectangleProps;
}

/** Tool Settings Zone React component.
 */
export class ToolSettingsZone extends React.Component<ToolSettingsZoneProps, ToolSettingsZoneState> {

  /** hidden */
  public readonly state: Readonly<ToolSettingsZoneState> = {
    toolSettingsZoneContent: ToolSettingsZoneContent.Closed,
    isPopoverOpen: false,
    isNestedPopoverOpen: false,
  };

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

  private getToolSettingsWidget() {
    const tab = (
      <ToolSettingsTab
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
        <ToolbarIcon
          key="0"
          isActive={
            this.state.toolSettingsZoneContent === ToolSettingsZoneContent.ToolSettings
          }
          onClick={
            () => {
              this.setState((prevState) => {
                let toolSettingsZoneContent = ToolSettingsZoneContent.Closed;

                if (prevState.toolSettingsZoneContent === ToolSettingsZoneContent.Closed)
                  toolSettingsZoneContent = ToolSettingsZoneContent.ToolSettings;
                return {
                  toolSettingsZoneContent,
                };
              });
            }
          }
          icon={
            <i className="icon icon-settings" />
          }
        />
      );
    }

    return null;
  }
}
