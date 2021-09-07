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
export interface StandardFrontstageProp {
  /* unique stage id */
  id: string;
  /* version id that is used to store state of stage */
  version?: number;
  // Usage of stage, if not specified StageUsage.General is used
  usage?: StageUsage | string;
  /** Definition of available content groups */
  contentGroupProps: ContentGroupProps;
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
  /** Props used to set initial size and state of panel. Defaults to:
   *  {size: 300, pinned=false, defaultState:StagePanelState.Minimized} */
  leftPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel. Defaults to:
   *  {size: 90, pinned=false, defaultState:StagePanelState.Minimized} */
  topPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel. Defaults to:
   *  {size: 200, pinned=true, defaultState:StagePanelState.Open} */
  rightPanelProps?: WidgetPanelProps;
  /** Props used to set initial size and state of panel. Defaults to:
   *  {size: 180, pinned=true, defaultState:StagePanelState.Open} */
  bottomPanelProps?: WidgetPanelProps;
  /** Application data is not require but exists for stages to pass feature settings to UiItemsProviders.
   * It is expected that the UiItemsProvider supply an xxxAppData interface to define the properties it
   * supports. See [[DefaultContentToolsAppData]] for an example.
   */
  applicationData?: any;
}

/**
 * @beta
 */
export class StandardFrontstageProvider extends FrontstageProvider {

  constructor(private props: StandardFrontstageProp) {
    super();
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    return (
      <Frontstage
        key={this.props.id}
        id={this.props.id}
        version={this.props.version ?? 1.0}
        defaultTool={CoreTools.selectElementCommand}
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
