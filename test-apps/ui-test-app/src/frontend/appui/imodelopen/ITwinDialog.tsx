/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Common.scss";
import "./ITwinDialog.scss";
import classnames from "classnames";
import * as React from "react";
import { SearchBox } from "@itwin/core-react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ITwinTab, ITwinTabs } from "./ITwinTabs";
import { Project as ITwin, ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import { IModelApp } from "@itwin/core-frontend";

/** Properties for the [[ITwinDialog]] component */
export interface ITwinDialogProps {
  onClose: () => void;
  onITwinSelected?: (iTwin: ITwin) => void;
}

interface ITwinDialogState {
  isLoading: boolean;
  iTwins?: ITwin[];
  filter: string;
}

/**
 * iTwin picker dialog
 */
export class ITwinDialog extends React.Component<ITwinDialogProps, ITwinDialogState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { isLoading: true, filter: "" };
  }

  // called when this component is first loaded
  public override async componentDidMount() {
    this.getRecentITwins(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private async getRecentITwins() {
    this.setState({ isLoading: true, iTwins: undefined });
    const client = new ProjectsAccessClient();
    const accessToken = await IModelApp.getAccessToken();
    const iTwins = await client.getAll(accessToken, {
      pagination: {
        top: 40,
      },
    });

    this.setState({ isLoading: false, iTwins });
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  };

  private _onMyITwinsClicked = () => {
    this.getRecentITwins(); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _onSearchClicked = () => {
    this.setState({ iTwins: undefined });
  };

  private _onITwinSelected = (iTwinInfo: ITwin) => {
    if (this.props.onITwinSelected) {
      this.props.onITwinSelected(iTwinInfo);
    }
  };

  private _handleSearchValueChanged = async (value: string) => {
    if (!value || value.trim().length === 0) {
      this.setState({ isLoading: false, iTwins: undefined, filter: value });
    } else {
      this.setState({ isLoading: true, iTwins: undefined });

      const accessToken = await IModelApp.getAccessToken();
      const client = new ProjectsAccessClient();
      client.getAll(accessToken, { // eslint-disable-line @typescript-eslint/no-floating-promises
        pagination: {
          top: 40,
        },
        search: {
          searchString: value,
          exactMatch: false,
          propertyName: ProjectsSearchableProperty.Name,
        },
      }).then((iTwins: ITwin[]) => {
        this.setState({ isLoading: false, iTwins, filter: value });
      });
    }
  };

  private getNoITwinsPrompt(): string {
    if (this.state.filter.trim() !== "")
      return `No matches found for '${this.state.filter}'`;
    else
      return "Search all iTwins by name, number, or other iTwin attribute.";
  }

  private getTabIndexFromITwinScope() {
    return 3;
  }

  private renderITwin(iTwin: ITwin) {
    return (
      <tr key={iTwin.id} onClick={this._onITwinSelected.bind(this, iTwin)}>
        <td>{iTwin.code}</td>
        <td>{iTwin.name}</td>
        <td />
        <td />
      </tr>
    );
  }

  public override render() {
    const searchClassName = classnames("tabs-searchbox", "hidden");
    return (
      <div className="modal-background fade-in-fast">
        <div className="itwins animate">
          <div className="header">
            <h3>Select ITwin</h3>
            <span onClick={this._onClose.bind(this)} className="icon icon-close" title="Close" />
          </div>
          <div className="itwins-content">
            <div className="tabs-container">
              <ITwinTabs defaultTab={this.getTabIndexFromITwinScope()}>
                <ITwinTab label="My ITwins" icon="icon-manager" onTabClicked={this._onMyITwinsClicked} />
                <ITwinTab label="Search" icon="icon-search" onTabClicked={this._onSearchClicked} />
              </ITwinTabs>
              <div className={searchClassName}>
                <SearchBox placeholder="Search..." onValueChanged={this._handleSearchValueChanged} valueChangedDelay={400} />
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ITwin Number</th>
                    <th>ITwin Name</th>
                  </tr>
                </thead>
                <tbody>
                  {(this.state.iTwins && this.state.iTwins.length > 0) && this.state.iTwins.map((iTwin: ITwin) => (this.renderITwin(iTwin)))}
                </tbody>
              </table>
              {this.state.isLoading &&
                <div className="itwins-loading">
                  <ProgressRadial size="large" indeterminate />
                </div>
              }
              {(!this.state.isLoading && (!this.state.iTwins || this.state.iTwins.length === 0)) && <div className="itwins-none">{this.getNoITwinsPrompt()}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
