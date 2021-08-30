/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { StageUsage } from "@bentley/ui-abstract";
import { StagePanel, StagePanelProps } from "../stagepanels/StagePanel";
import { ContentGroup, ContentGroupProps } from "../content/ContentGroup";
import { FrontstageProvider } from "./FrontstageProvider";
import { Frontstage, FrontstageProps } from "./Frontstage";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { Zone } from "../zones/Zone";
import { ContentToolWidgetComposer } from "../widgets/ContentToolWidgetComposer";
import { Widget } from "../widgets/Widget";
import { ViewToolWidgetComposer } from "../widgets/ViewToolWidgetComposer";
import { StatusBarWidgetComposerControl } from "../widgets/StatusBarWidgetComposerControl";
import { StagePanelState } from "../stagepanels/StagePanelDef";

/** Properties of a [[WidgetPanelProps]] component
 * @beta
 */
export type WidgetPanelProps = Omit<StagePanelProps, "widgets" | "runtimeProps" | "header" | "allowedZones" | "panelZones">;

/**
 * @beta
 */
export interface StandardStageProps {
  /* unique stage id */
  id: string;
  /* version id that is used to store state of stage */
  version?: number;
  // Usage of stage, if not specified StageUsage.General is used
  usage?: StageUsage | string;
  /** Definition of available content groups */
  contentGroupProps: ContentGroupProps;
  /** Default Layout id */
  defaultLayout: string;  /* | LayoutType */
  /** Specify button to use to open backstage. Leave undefined for no backstage button.
   * ```
   * <BackstageAppButton icon={"icon-bentley-systems"} />
   * ```
   */
  cornerButton?: React.ReactNode;
  /** Set to true if default Navigation aid is not desired */
  hideNavigationAid?: boolean;
  /** Set to true if no status bar is needed in stage */
  hideStatusBar?: boolean;
  /** Props used to set initial size and state of panel */
  leftPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel */
  topPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel */
  rightPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel */
  bottomPanelProps?: WidgetPanelProps;
  applicationData?: any;
}

/**
 * @beta
 */
export class StandardFrontstageProvider extends FrontstageProvider {

  constructor(private props: StandardStageProps) {
    super();
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    return (
      <Frontstage
        key={this.props.id}
        id={this.props.id}
        version={this.props.version ?? 1.0}
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this.props.defaultLayout ?? "SingleContent"}
        contentGroup={new ContentGroup(this.props.contentGroupProps)}
        isInFooterMode={true}
        usage={this.props.usage ?? StageUsage.General}
        applicationData={this.props.applicationData}

        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget id={`${this.props.id}-contentManipulationTools`} key={`${this.props.id}-contentManipulationTools`} isFreeform={true}
                  element={<ContentToolWidgetComposer cornerButton={this.props.cornerButton} />}
                />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={
              [
                <Widget id={`${this.props.id}-viewNavigationTools`} key={`${this.props.id}-viewNavigationTools`} isFreeform={true}
                  element={<ViewToolWidgetComposer hideNavigationAid={this.props.hideNavigationAid} />}
                />,
              ]}
          />
        }
        toolSettings={
          <Zone
            widgets={
              [
                <Widget id={`${this.props.id}-toolSettings`} key={`${this.props.id}-toolSettings`} isToolSettings={true} />,
              ]}
          />
        }
        statusBar={
          <Zone
            widgets={
              this.props.hideStatusBar ? [] :
                [
                  <Widget id={`${this.props.id}-statusBar`} key={`${this.props.id}-statusBar`} isStatusBar={true}
                    control={StatusBarWidgetComposerControl} />,
                ]
            }
          />
        }

        leftPanel={
          <StagePanel
            size={300}
            pinned={false}
            defaultState={StagePanelState.Minimized}
            {...this.props.leftPanelProps}
          />
        }

        topPanel={
          <StagePanel
            size={90}
            pinned={false}
            defaultState={StagePanelState.Minimized}
            {...this.props.topPanelProps}
          />
        }

        rightPanel={
          <StagePanel
            defaultState={StagePanelState.Open}
            {...this.props.rightPanelProps}

          />
        }

        bottomPanel={
          <StagePanel
            size={180}
            defaultState={StagePanelState.Open}
            {...this.props.bottomPanelProps}
          />
        }
      />
    );
  }
}
