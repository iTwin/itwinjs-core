/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
import { StageUsage } from "@itwin/appui-abstract";
import { StagePanel, StagePanelProps } from "../stagepanels/StagePanel";
import { ContentGroup, ContentGroupProps, ContentGroupProvider } from "../content/ContentGroup";
import { FrontstageProvider } from "./FrontstageProvider";
import { Frontstage, FrontstageProps } from "./Frontstage";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { Zone } from "../zones/Zone";
import { ContentToolWidgetComposer } from "../widgets/ContentToolWidgetComposer";
import { Widget } from "../widgets/Widget";
import { ViewToolWidgetComposer } from "../widgets/ViewToolWidgetComposer";
import { StatusBarWidgetComposerControl } from "../widgets/StatusBarWidgetComposerControl";
import { StagePanelState } from "../stagepanels/StagePanelDef";
import { ToolItemDef } from "../shared/ToolItemDef";

/** Properties of a [[WidgetPanelProps]] component
 * @public
 */
export type WidgetPanelProps = Omit<StagePanelProps, "widgets" | "runtimeProps" | "header" | "allowedZones" | "panelZones">; // eslint-disable-line deprecation/deprecation

/**
 * Props for [[StandardFrontstageProvider]]
 * @public
 */
export interface StandardFrontstageProps {
  /* unique stage id. To ensure uniqueness it is common practice to format id like `appName:stageId` */
  id: string;
  /* version id that is used to store state of stage */
  version?: number;
  // Usage of stage. To allow generic UiItemProvides to populate this stage set to `StageUsage.General`.
  usage: StageUsage | string;
  /** Definition of available content groups or a function that provides them */
  contentGroupProps: ContentGroupProps | ContentGroupProvider;
  /** Specify button to use to open backstage. Leave undefined for no backstage button.
   * ```
   * <BackstageAppButton icon={"icon-bentley-systems"} />
   * ```
   * Custom corner button definition
   * ```
   * const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"}
   *   label="Toggle Backstage display",
   *   execute={() => BackstageManager.getBackstageToggleCommand().execute()} />;
   * ```
   */
  cornerButton?: React.ReactNode;
  /** Set to true if default Navigation aid is not desired */
  hideNavigationAid?: boolean;
  /** Set to true if no tool setting dock is needed. Typically only used in modal stages. */
  hideToolSettings?: boolean;
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
  /** The defaultTool is is started when then frontstage loads and whenever any other tools exit.
   * Most of the time, this is the Element Selection Tool (CoreTools.selectElementCommand).
   * Your app can specify its own tool or another core tool as default with this property.
   */
  defaultTool?: ToolItemDef;
}

/**
 * FrontstageProvider that provides an "empty" stage. All tool buttons, statusbar items, and widgets must
 * be provided by one or more item providers, see [UiItemsProvider]($appui-abstract).
 * @public
 */
export class StandardFrontstageProvider extends FrontstageProvider {
  constructor(private props: StandardFrontstageProps) {
    super();
  }

  public get id(): string {
    return this.props.id;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> { // eslint-disable-line deprecation/deprecation
    const contentGroup = (this.props.contentGroupProps instanceof ContentGroupProvider) ? this.props.contentGroupProps : new ContentGroup(this.props.contentGroupProps);
    return (
      <Frontstage // eslint-disable-line deprecation/deprecation
        key={this.props.id}
        id={this.props.id}
        version={this.props.version ?? 1.0}
        defaultTool={this.props.defaultTool ?? CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        isInFooterMode={true}
        usage={this.props.usage}
        applicationData={this.props.applicationData}

        contentManipulationTools={
          <Zone // eslint-disable-line deprecation/deprecation
            widgets={
              [
                <Widget id={`${this.props.id}-contentManipulationTools`} key={`${this.props.id}-contentManipulationTools`} isFreeform={true} // eslint-disable-line deprecation/deprecation
                  element={<ContentToolWidgetComposer cornerButton={this.props.cornerButton} />}
                />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone // eslint-disable-line deprecation/deprecation
            widgets={
              [
                <Widget id={`${this.props.id}-viewNavigationTools`} key={`${this.props.id}-viewNavigationTools`} isFreeform={true} // eslint-disable-line deprecation/deprecation
                  element={<ViewToolWidgetComposer hideNavigationAid={this.props.hideNavigationAid} />}
                />,
              ]}
          />
        }
        toolSettings={
          <Zone // eslint-disable-line deprecation/deprecation
            widgets={
              this.props.hideToolSettings ? [] :
                [
                  <Widget id={`${this.props.id}-toolSettings`} key={`${this.props.id}-toolSettings`} isToolSettings={true} />, // eslint-disable-line deprecation/deprecation
                ]
            }
          />
        }
        statusBar={
          <Zone // eslint-disable-line deprecation/deprecation
            widgets={
              this.props.hideStatusBar ? [] :
                [
                  <Widget id={`${this.props.id}-statusBar`} key={`${this.props.id}-statusBar`} isStatusBar={true} // eslint-disable-line deprecation/deprecation
                    control={StatusBarWidgetComposerControl} />,
                ]
            }
          />
        }

        leftPanel={
          <StagePanel // eslint-disable-line deprecation/deprecation
            size={300}
            pinned={false}
            defaultState={StagePanelState.Minimized}
            {...this.props.leftPanelProps}
          />
        }

        topPanel={
          <StagePanel // eslint-disable-line deprecation/deprecation
            size={90}
            pinned={false}
            defaultState={StagePanelState.Minimized}
            {...this.props.topPanelProps}
          />
        }

        rightPanel={
          <StagePanel // eslint-disable-line deprecation/deprecation
            defaultState={StagePanelState.Open}
            {...this.props.rightPanelProps}

          />
        }

        bottomPanel={
          <StagePanel // eslint-disable-line deprecation/deprecation
            size={180}
            defaultState={StagePanelState.Open}
            {...this.props.bottomPanelProps}
          />
        }
      />
    );
  }
}
