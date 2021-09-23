/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ProjectDropdown.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@bentley/ui-abstract";
import { Popup } from "@bentley/ui-core";
import { ITwin } from "@bentley/itwin-registry-client";

/** Properties for the [[ITwinDropdown]] component */
export interface ITwinDropdownProps {
  numVisibleiTwins?: number;
  recentiTwins?: ITwin[];
  currentiTwin?: ITwin;
  oniTwinClicked: (itwin: ITwin) => any;
}

interface ITwinDropdownState {
  isDropdownOpen: boolean;
  showiTwinsDialog: boolean;
}

/**
 * List of iTwin Projects in a dropdown
 */
export class ITwinDropdown extends React.Component<ITwinDropdownProps, ITwinDropdownState> {
  private _itemHeight: number = 3.25; // each item (iTwin) height is (n-em) in the dropdown
  private _target: HTMLElement | null = null;

  public static defaultProps: Partial<ITwinDropdownProps> = {
    numVisibleiTwins: 5, // default number of visible iTwin to 5
  };

  constructor(props: ITwinDropdownProps, context?: any) {
    super(props, context);
    this.state = { isDropdownOpen: false, showiTwinsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState({ showiTwinsDialog: true });
  };

  private _onItemClick(itwin: ITwin) {
    this.closeDropdown();
    this.props.oniTwinClicked(itwin);
  }

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((prevState) => ({ isDropdownOpen: !prevState.isDropdownOpen }));
  };

  private _handleOnOutsideClick = () => {
    this.closeDropdown();
  };

  private closeDropdown() {
    this.setState({ isDropdownOpen: false });
  }

  private getiTwins(): ITwin[] {
    if (this.props.recentiTwins) {
      return this.props.recentiTwins;
    }
    return [];
  }

  private renderiTwins() {
    const itwins: ITwin[] = this.getiTwins();
    const ulStyle: React.CSSProperties = {
      height: `${this.props.numVisibleiTwins! * this._itemHeight}em`,
    };
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };

    if (itwins && itwins.length === 0) {
      return (
        <div className="pp-no-mru" style={ulStyle}><p>Most recently used iTwins appear here.</p>Click &quot;More&quot; below to search for an iTwin and add it to this list.</div>
      );
    } else {
      return (
        <ul style={ulStyle}>
          {itwins && itwins.map((project: ITwin, i: number) => (
            <li style={liStyle} key={i} onClick={() => this._onItemClick(project)}>
              <span className="pp-icon icon icon-placeholder" />
              <div className="pp-details">
                <span>{project.code}</span>
                <span>{project.name}</span>
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
        <div className="pp-dropdown">
          {this.renderiTwins()}
          <div className="pp-separator" />
          <div className="pp-more" style={liStyle} onClick={this._onMoreClicked} >
            <span className="pp-icon icon icon-search" />
            More
          </div>
        </div>
      </Popup>
    );
  }

  public override render() {
    const splitterClassName = classnames("pp-splitter icon icon-chevron-down", this.state.isDropdownOpen && "opened");
    return (
      <div className="pp">
        <div className="pp-content" onClick={this._splitterClicked} ref={(element) => { this._target = element; }}>
          <div>
            <span className="number">{this.props.currentiTwin ? this.props.currentiTwin.code : ""}</span>
            <span className="name">{this.props.currentiTwin ? this.props.currentiTwin.name : ""}</span>
          </div>
          <span className={splitterClassName} />
        </div>
        <div className="pp-highlight" />
        {this.renderDropdown()}
      </div>
    );
  }
}
