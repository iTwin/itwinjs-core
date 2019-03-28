/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ViewportComponent } from "@bentley/ui-components";
import { ConfigurableCreateInfo, ConfigurableUiManager, ViewportContentControl } from "@bentley/ui-framework";
import { ScreenViewport, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";
import { TimelineComponent } from "../timeline/TimelineComponent";
import { Milestone } from "../timeline/Interfaces";
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
  startDate: Date;
  endDate: Date;
  milestones?: Milestone[];
}

/** iModel Viewport React component */
class ScheduleAnimationViewport extends React.Component<ScheduleAnimationViewportProps, ScheduleAnimationViewportState> {

  constructor(props: any) {
    super(props);

    const _startDate = new Date();
    const _endDate = new Date(_startDate.getTime() + (86400000 * 10));

    this.state = ( {viewId: undefined, startDate: _startDate, endDate: _endDate} );
  }

  public async componentDidMount() {
    await this._getView();
  }

  private async _getView() {
    const viewQueryParams: ViewQueryParams = { wantPrivate: false };
    let viewProps: ViewDefinitionProps[] = [];
    try {
      viewProps = await this.props.iModelConnection.views.queryProps(viewQueryParams);
      for (const view of viewProps) {
        const viewState = await this.props.iModelConnection.views.load(view.id!);
        if (viewState && viewState.scheduleScript) {
          this._setSchedule (viewState);
          return;
        }
      }
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log("error getting views", e);
    }
  }

  private _setSchedule (viewState: ViewState) {
    const timeRange = viewState.scheduleScript!.duration;
    const startDate = new Date(timeRange.low * 1000);
    const endDate = new Date(timeRange.high * 1000);

    const quarter = (endDate.getTime() - startDate.getTime()) / 4;
    const milestones: Milestone[] = [];
    milestones.push ({label: "1st Floor Concrete", date: new Date(startDate.getTime() + quarter)});
    milestones.push ({label: "2nd Floor Concrete", date: new Date(endDate.getTime() - quarter)});

    this.setState ( {viewId: viewState.id, startDate, endDate, milestones});
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
              <LoadingSpinner message="Searching for schedule animation..."/>
            </div>
          }
          {this.state.viewId &&
            <UnifiedSelectionViewport viewportRef={this.props.viewportRef}
                viewDefinitionId={this.state.viewId} imodel={this.props.iModelConnection} ruleset="Default" />
          }
        </div>
        {this.state.viewId &&
          <div style={{ zIndex: 2000 }}>
            <TimelineComponent
                  startDate={this.state.startDate}
                  endDate={this.state.endDate}
                  selectedDate={this.state.startDate}
                  milestones={this.state.milestones}
                  hideTimeline={false} />
          </div>
        }
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("ScheduleAnimationControl", ScheduleAnimationViewportControl);
