/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { ViewDefinitionProps, ViewQueryParams } from "@itwin/core-common";
import { IModelConnection, ScreenViewport, ViewState } from "@itwin/core-frontend";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";
import { TimelineComponent, TimelineDataProvider, ViewportComponent } from "@itwin/imodel-components-react";
import { LoadingSpinner } from "@itwin/core-react";
import {
  AnalysisAnimationTimelineDataProvider, ConfigurableCreateInfo, ConfigurableUiManager, ContentViewManager, ScheduleAnimationTimelineDataProvider,
  UiFramework, ViewportContentControl,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../..";

// create a HOC viewport component that supports unified selection
// eslint-disable-next-line @typescript-eslint/naming-convention
const UnifiedSelectionViewport = viewWithUnifiedSelection(ViewportComponent);

/** iModel Viewport Control
 */
export class ScheduleAnimationViewportControl extends ViewportContentControl {

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const _iModelConnection = UiFramework.getIModelConnection();

    if (_iModelConnection)
      this.reactNode = <ScheduleAnimationViewport iModelConnection={_iModelConnection} viewportRef={(v: ScreenViewport) => { this.viewport = v; }} />;
    else
      this.reactNode = null;
  }
}

interface ScheduleAnimationViewportProps {
  viewportRef?: (v: ScreenViewport) => void;
  iModelConnection: IModelConnection;
}

interface ScheduleAnimationViewportState {
  viewId?: Id64String;
  dataProvider?: TimelineDataProvider;
  rangeValue: number;
}

/** iModel Viewport React component */
class ScheduleAnimationViewport extends React.Component<ScheduleAnimationViewportProps, ScheduleAnimationViewportState> {
  constructor(props: any) {
    super(props);

    this.state = ({ viewId: undefined, dataProvider: undefined, rangeValue: 0 });
  }

  public override async componentDidMount() {
    await this._getView();
  }

  public override componentWillUnmount() {
  }

  private async _getView() {
    const savedAnimationViewId = SampleAppIModelApp.getAnimationViewId();
    if (savedAnimationViewId && savedAnimationViewId.length > 0) {
      const viewState = await this.props.iModelConnection.views.load(savedAnimationViewId);
      SampleAppIModelApp.saveAnimationViewId(""); // clear out the saved viewId
      if (viewState) {
        if (await this._setTimelineDataProvider(viewState))
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
            if (await this._setTimelineDataProvider(viewState))
              return;
            if (undefined === firstViewId)
              firstViewId = view.id!;
          }
        }
        this.setState({ viewId: firstViewId });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("error getting views", e);
      }
    }
  }

  private async _getTimelineDataProvider(viewState: ViewState): Promise<TimelineDataProvider | undefined> {
    let timelineDataProvider: TimelineDataProvider;

    timelineDataProvider = new ScheduleAnimationTimelineDataProvider(viewState);
    if (timelineDataProvider.supportsTimelineAnimation) {
      if (await timelineDataProvider.loadTimelineData())
        return timelineDataProvider;
    } else {
      timelineDataProvider = new AnalysisAnimationTimelineDataProvider(viewState);
      if (timelineDataProvider.supportsTimelineAnimation) {
        if (await timelineDataProvider.loadTimelineData())
          return timelineDataProvider;
      }
    }
    return undefined;
  }

  private _onAnimationFractionChanged = (animationFraction: number) => {
    if (this.state.dataProvider && undefined === this.state.dataProvider.viewport) {
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport) {
        if (this.state.viewId === activeContentControl.viewport.view.id)
          this.state.dataProvider.viewport = activeContentControl.viewport; // eslint-disable-line react/no-direct-mutation-state
      }
    }

    if (this.state.dataProvider && this.state.dataProvider.onAnimationFractionChanged)
      this.state.dataProvider.onAnimationFractionChanged(animationFraction);
  };

  private async _setTimelineDataProvider(viewState: ViewState): Promise<boolean> {
    const dataProvider = await this._getTimelineDataProvider(viewState);
    if (dataProvider && dataProvider.supportsTimelineAnimation) {
      this.setState({ viewId: viewState.id, dataProvider });
      return true;
    }
    return false;
  }

  private _handleRangeChange = ((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    this.setState({ rangeValue: value });
  });

  public override render(): React.ReactNode {
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
              viewDefinitionId={this.state.viewId} imodel={this.props.iModelConnection} />
          }
        </div>
        {this.state.dataProvider &&
          <div>
            <input type="range" min="0" max={this.state.dataProvider.duration} step="1" value={this.state.rangeValue} onChange={this._handleRangeChange} />
            <TimelineComponent
              startDate={this.state.dataProvider.start}
              endDate={this.state.dataProvider.end}
              initialDuration={this.state.rangeValue}
              totalDuration={this.state.dataProvider.duration}
              minimized={true}
              onChange={this._onAnimationFractionChanged}
              showDuration={true} />
          </div>
        }
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("ScheduleAnimationControl", ScheduleAnimationViewportControl);
