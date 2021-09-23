/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./IModelOpen.scss";
import "./Common.scss";
import classnames from "classnames";
import * as React from "react";
import { ActivityMessagePopup, IModelInfo, UiFramework } from "@bentley/ui-framework";
import { AppTools } from "../../tools/ToolSpecifications";
import { BlockingPrompt } from "./BlockingPrompt";
import { IModelList } from "./IModelList";
import { NavigationItem, NavigationList } from "./Navigation";
import { ITwinDropdown } from "./ProjectDropdown";
import { ActivityMessageDetails, ActivityMessageEndReason, IModelApp } from "@bentley/imodeljs-frontend";
import { BeDuration } from "@bentley/bentleyjs-core";
import { Button } from "@itwin/itwinui-react";
import { ITwin } from "@bentley/itwin-registry-client";

/** Properties for the [[IModelOpen]] component */
export interface IModelOpenProps {
  onIModelSelected?: (iModelInfo: IModelInfo) => void;
  initialIModels?: IModelInfo[];
}

interface IModelOpenState {
  isLoadingiTwin: boolean;
  isLoadingiTwins: boolean;
  isLoadingiModel: boolean;
  recentiTwins?: ITwin[];
  iModels?: IModelInfo[];
  currentiTwin?: ITwin;
  prompt: string;
  isNavigationExpanded: boolean;
}

/**
 * Open component showing iTwins and iModels
 */
export class IModelOpen extends React.Component<IModelOpenProps, IModelOpenState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingiTwin: true,
      isLoadingiTwins: false,
      isLoadingiModel: false,
      isNavigationExpanded: false,
      prompt: "Fetching iTwin information...",
    };
  }

  public override async componentDidMount(): Promise<void> {
    if (this.props.initialIModels && this.props.initialIModels.length > 0) {
      const currentiTwin = this.props.initialIModels[0].iTwinInfo;
      currentiTwin.id = "";

      this.setState({
        isLoadingiTwin: false,
        isLoadingiTwins: false,
        isLoadingiModel: false,
        currentiTwin: this.props.initialIModels[0].iTwinInfo, // eslint-disable-line @bentley/react-set-state-usage
        iModels: this.props.initialIModels,  // eslint-disable-line @bentley/react-set-state-usage
      });
    }
  }

  // retrieves the IModels for a iTwin. Called when first mounted and when a new iTwin is selected.
  private async startRetrieveIModels(itwin: ITwin) {
    this.setState({
      prompt: "Fetching iModel information...",
      isLoadingiTwins: true,
      isLoadingiTwin: false,
      currentiTwin: itwin,
    });
    const iModelInfos: IModelInfo[] = await UiFramework.iModelServices.getIModels(itwin, 80, 0);
    this.setState({
      isLoadingiTwins: false,
      iModels: iModelInfos,
    });
  }

  private _onNavigationChanged = (expanded: boolean) => {
    this.setState({ isNavigationExpanded: expanded });
  };

  private _selectiTwin(itwin: ITwin) {
    this.startRetrieveIModels(itwin); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private _handleIModelSelected = (iModelInfo: IModelInfo): void => {
    this.setState({
      prompt: `Opening '${iModelInfo.name}'...`,
      isLoadingiModel: true,
    }, () => {
      if (this.props.onIModelSelected)
        this.props.onIModelSelected(iModelInfo);
    });
  };

  private renderIModels() {
    if (this.state.isLoadingiTwin || this.state.isLoadingiTwins) {
      return (
        <BlockingPrompt prompt={this.state.prompt} />
      );
    } else {
      return (
        <>
          <IModelList iModels={this.state.iModels}
            onIModelSelected={this._handleIModelSelected} />
          {this.state.isLoadingiModel &&
            <BlockingPrompt prompt={this.state.prompt} />
          }
        </>
      );
    }
  }

  /** Tool that will start a sample activity and display ActivityMessage.
   */
  private _activityTool = async () => {
    let isCancelled = false;
    let progress = 0;

    const details = new ActivityMessageDetails(true, true, true, true);
    details.onActivityCancelled = () => {
      isCancelled = true;
    };
    IModelApp.notifications.setupActivityMessage(details);

    while (!isCancelled && progress <= 100) {
      IModelApp.notifications.outputActivityMessage("This is a sample activity message", progress);
      await BeDuration.wait(100);
      progress++;
    }

    const endReason = isCancelled ? ActivityMessageEndReason.Cancelled : ActivityMessageEndReason.Completed;
    IModelApp.notifications.endActivityMessage(endReason);
  };

  public override render() {
    const contentStyle = classnames("open-content", this.state.isNavigationExpanded && "pinned");
    return (
      <>
        <div>
          <div className="open-appbar">
            <div className="backstage-icon">
              <span className="icon icon-home" onPointerUp={() => AppTools.backstageToggleCommand.execute()} />
            </div>
            <div className="itwin-picker-content">
              <span className="itwins-label">iTwins</span>
              <div className="itwin-picker">
                <ITwinDropdown currentiTwin={this.state.currentiTwin} recentiTwins={this.state.recentiTwins} oniTwinClicked={this._selectiTwin.bind(this)} />
              </div>
            </div>
            <Button styleType="cta" style={{ display: "none" }} className="activity-button" onClick={this._activityTool}>Activity Message</Button>
          </div>
          <NavigationList defaultTab={0} onExpandChanged={this._onNavigationChanged}>
            <NavigationItem label="Recent" icon="icon-placeholder" />
            <NavigationItem label="Offline" icon="icon-placeholder" />
            <NavigationItem label="Browse History" icon="icon-placeholder" />
            <NavigationItem label="iModels" icon="icon-placeholder" />
            <NavigationItem label="Share" icon="icon-placeholder" />
            <NavigationItem label="Share Point" icon="icon-placeholder" />
            <NavigationItem label="Reality Data" icon="icon-placeholder" />
            <NavigationItem label="New iTwin Project..." icon="icon-placeholder" />
          </NavigationList>
          <div className={contentStyle}>
            {this.renderIModels()}
          </div>
        </div>
        <ActivityMessagePopup />
      </>
    );
  }
}
