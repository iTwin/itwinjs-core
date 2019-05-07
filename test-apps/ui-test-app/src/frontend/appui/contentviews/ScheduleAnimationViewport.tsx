/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ViewportComponent, TimelineDataProvider, TimelineComponent } from "@bentley/ui-components";
import { ConfigurableCreateInfo, ConfigurableUiManager, ViewportContentControl, ContentViewManager, ScheduleAnimationTimelineDataProvider, AnalysisAnimationTimelineDataProvider } from "@bentley/ui-framework";
import { ScreenViewport, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";
import { ViewQueryParams, ViewDefinitionProps } from "@bentley/imodeljs-common";
import { SampleAppIModelApp } from "../..";
import { Id64String } from "@bentley/bentleyjs-core";
import { LoadingSpinner } from "@bentley/ui-core";

// create a HOC viewport component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionViewport = viewWithUnifiedSelection(ViewportComponent);

/** iModel Viewport Control
 */
export class ScheduleAnimationViewportControl extends ViewportContentControl {

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const _iModelConnection = SampleAppIModelApp.store.getState().sampleAppState!.currentIModelConnection!;

    this.reactElement = <ScheduleAnimationViewport iModelConnection={_iModelConnection} viewportRef={(v: ScreenViewport) => { this.viewport = v; }} />;
  }
}

interface ScheduleAnimationViewportProps {
  viewportRef?: (v: ScreenViewport) => void;
  iModelConnection: IModelConnection;
}

interface ScheduleAnimationViewportState {
  viewId?: Id64String;
  dataProvider?: TimelineDataProvider;
}

/** iModel Viewport React component */
class ScheduleAnimationViewport extends React.Component<ScheduleAnimationViewportProps, ScheduleAnimationViewportState> {
  constructor(props: any) {
    super(props);

    this.state = ({ viewId: undefined, dataProvider: undefined });
  }

  public async componentDidMount() {
    await this._getView();
  }

  public componentWillUnmount() {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = 0;
    }
  }

  private async _getView() {
    const savedAnimationViewId = SampleAppIModelApp.getAnimationViewId();
    if (savedAnimationViewId && savedAnimationViewId.length > 0) {
      const viewState = await this.props.iModelConnection.views.load(savedAnimationViewId);
      SampleAppIModelApp.saveAnimationViewId(""); // clear out the saved viewId
      if (viewState) {
        if (this._setTimelineDataProvider(viewState))
          return;
      }
    } else {
      const viewQueryParams: ViewQueryParams = { wantPrivate: false };
      let viewProps: ViewDefinitionProps[] = [];
      try {
        let firstViewId;
        // find first view with animation data
        viewProps = await this.props.iModelConnection.views.queryProps(viewQueryParams);
        for (const view of viewProps) {
          const viewState = await this.props.iModelConnection.views.load(view.id!);
          if (viewState) {
            if (this._setTimelineDataProvider(viewState))
              return;
            if (undefined === firstViewId)
              firstViewId = view.id!;
          }
        }
        this.setState({ viewId: firstViewId });
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log("error getting views", e);
      }
    }
  }

  private _getTimelineDataProvider(viewState: ViewState): TimelineDataProvider | undefined {
    let timelineDataProvider: TimelineDataProvider;

    timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewState);
    if (timelineDataProvider.supportsTimelineAnimation) {
      if (timelineDataProvider.loadTimelineData())
        return timelineDataProvider as TimelineDataProvider;
    } else {
      timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewState);
      if (timelineDataProvider.supportsTimelineAnimation) {
        if (timelineDataProvider.loadTimelineData())
          return timelineDataProvider as TimelineDataProvider;
      }
    }
    return undefined;
  }

  private _onAnimationFractionChanged = (animationFraction: number) => {
    if (this.state.dataProvider && undefined === this.state.dataProvider.viewport) {
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport) {
        if (this.state.viewId === activeContentControl.viewport.view.id)
          this.state.dataProvider.viewport = activeContentControl.viewport;
      }
    }

    if (this.state.dataProvider && this.state.dataProvider.onAnimationFractionChanged)
      this.state.dataProvider.onAnimationFractionChanged(animationFraction);
  }

  private _setTimelineDataProvider(viewState: ViewState): boolean {
    const dataProvider = this._getTimelineDataProvider(viewState);
    if (dataProvider && dataProvider.supportsTimelineAnimation) {
      this.setState({ viewId: viewState.id, dataProvider });
      return true;
    }
    return false;
  }

  public render(): React.ReactNode {
    const divStyle: React.CSSProperties = {
      backgroundColor: "white",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    };

    const content: React.CSSProperties = {
      flex: "1",
      position: "relative",
    };

    const center: React.CSSProperties = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };

    return (
      <div className="ContentViewPane" style={divStyle}>
        <div style={content}>
          {!this.state.viewId &&
            <div style={center}>
              <LoadingSpinner message="Searching for schedule animation..." />
            </div>
          }
          {this.state.viewId &&
            <UnifiedSelectionViewport viewportRef={this.props.viewportRef}
              viewDefinitionId={this.state.viewId} imodel={this.props.iModelConnection} ruleset="Default" />
          }
        </div>
        {this.state.dataProvider &&
          <div>
            <TimelineComponent
              startDate={this.state.dataProvider.start}
              endDate={this.state.dataProvider.end}
              totalDuration={this.state.dataProvider.duration}
              milestones={this.state.dataProvider.getMilestones()}
              minimized={this.state.dataProvider.getMilestones().length === 0}
              onChange={this._onAnimationFractionChanged} />
          </div>
        }
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("ScheduleAnimationControl", ScheduleAnimationViewportControl);
