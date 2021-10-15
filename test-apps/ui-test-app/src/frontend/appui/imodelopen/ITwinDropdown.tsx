/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ITwinDropdown.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popup } from "@itwin/core-react";
import { Project as ITwin } from "@itwin/projects-client";

/** Properties for the [[ITwinDropdown]] component */
export interface ITwinDropdownProps {
  numVisibleITwins?: number;
  recentITwins?: ITwin[];
  currentITwin?: ITwin;
  onITwinClicked: (iTwin: ITwin) => any;
}

interface ITwinDropdownState {
  isDropdownOpen: boolean;
  showITwinsDialog: boolean;
}

/**
 * List of iTwins in a dropdown
 */
export class ITwinDropdown extends React.Component<ITwinDropdownProps, ITwinDropdownState> {
  private _itemHeight: number = 3.25; // each item (iTwin) height is (n-em) in the dropdown
  private _target: HTMLElement | null = null;

  public static defaultProps: Partial<ITwinDropdownProps> = {
    numVisibleITwins: 5, // default number of visible iTwin to 5
  };

  constructor(props: ITwinDropdownProps, context?: any) {
    super(props, context);
    this.state = { isDropdownOpen: false, showITwinsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState({ showITwinsDialog: true });
  };

  private _onItemClick(iTwin: ITwin) {
    this.closeDropdown();
    this.props.onITwinClicked(iTwin);
  }

  private _onITwinSelected = (iTwin: ITwin) => {
    this.closeDialog();
    this.props.onITwinClicked(iTwin);
  };

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((prevState) => ({ isDropdownOpen: !prevState.isDropdownOpen }));
  };

  private _handleOnOutsideClick = () => {
    this.closeDropdown();
  };

  private closeDropdown() {
    this.setState({ isDropdownOpen: false });
  }

  private closeDialog() {
    this.setState({ showITwinsDialog: false });
  }

  private getITwins(): ITwin[] {
    if (this.props.recentITwins) {
      return this.props.recentITwins;
    }
    return [];
  }

  private renderITwins() {
    const iTwins: ITwin[] = this.getITwins();
    const ulStyle: React.CSSProperties = {
      height: `${this.props.numVisibleITwins! * this._itemHeight}em`,
    };
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };

    if (iTwins && iTwins.length === 0) {
      return (
        <div className="ip-no-mru" style={ulStyle}><p>Most recently used iTwins appear here.</p>Click &quot;More&quot; below to search for an iTwin and add it to this list.</div>
      );
    } else {
      return (
        <ul style={ulStyle}>
          {iTwins && iTwins.map((iTwin: ITwin, i: number) => (
            <li style={liStyle} key={i} onClick={() => this._onItemClick(iTwin)}>
              <span className="ip-icon icon icon-placeholder" />
              <div className="ip-details">
                <span>{iTwin.code}</span>
                <span>{iTwin.name}</span>
              </div>
            </li>
          ))}
        </ul>
      );
    }
  }

  private renderDropdown() {
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };
    return (
      <Popup isOpen={this.state.isDropdownOpen} position={RelativePosition.Bottom} onClose={this._handleOnOutsideClick} target={this._target}>
        <div className="ip-dropdown">
          {this.renderITwins()}
          <div className="ip-separator" />
          <div className="ip-more" style={liStyle} onClick={this._onMoreClicked} >
            <span className="ip-icon icon icon-search" />
            More
          </div>
        </div>
      </Popup>
    );
  }

  public override render() {
    const splitterClassName = classnames("ip-splitter icon icon-chevron-down", this.state.isDropdownOpen && "opened");
    return (
      <div className="ip">
        <div className="ip-content" onClick={this._splitterClicked} ref={(element) => { this._target = element; }}>
          <div>
            <span className="number">{this.props.currentITwin ? this.props.currentITwin.code : ""}</span>
            <span className="name">{this.props.currentITwin ? this.props.currentITwin.name : ""}</span>
          </div>
          <span className={splitterClassName} />
        </div>
        <div className="ip-highlight" />
        {this.renderDropdown()}
      </div>
    );
  }
}
