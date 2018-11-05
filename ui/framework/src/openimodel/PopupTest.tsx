/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import "./Common.scss";
import "./PopupTest.scss";
import { Popup, Position } from "@bentley/ui-core";
import { Toggle } from "@bentley/ui-core";

interface PopupTestProps {
  onClose: () => void;
}

interface PopupTestState {
  showTopLeft: boolean;
  showTop: boolean;
  showTopRight: boolean;
  showBottomLeft: boolean;
  showBottom: boolean;
  showBottomRight: boolean;
  showLeft: boolean;
  showRight: boolean;
  showArrow: boolean;
  showShadow: boolean;
  showStatusBarColors: boolean;
  onHover: boolean;
}

/**
 * Test for popups.  Do not use, ths will be removed!
 * @hidden
 */
export class PopupTest extends React.Component<PopupTestProps, PopupTestState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showTopLeft: false, showTop: false, showTopRight: false, showBottomLeft: false, showBottom: false, showBottomRight: false,
      showArrow: false, showStatusBarColors: false, showLeft: false, showRight: false, showShadow: true, onHover: false,
    };
  }

  private _toggleTopLeft = () => {
    this.setState((_prevState) => ({ showTopLeft: !this.state.showTopLeft }));
  }

  private _closeTopLeft = () => {
    this.setState((_prevState) => ({ showTopLeft: false }));
  }

  private _toggleTop = () => {
    this.setState((_prevState) => ({ showTop: !this.state.showTop }));
  }

  private _closeTop = () => {
    this.setState((_prevState) => ({ showTop: false }));
  }

  private _toggleTopRight = () => {
    this.setState((_prevState) => ({ showTopRight: !this.state.showTopRight }));
  }

  private _onCloseTopRight = () => {
    this.setState((_prevState) => ({ showTopRight: false }));
  }

  private _toggleBottomLeft = () => {
    this.setState((_prevState) => ({ showBottomLeft: !this.state.showBottomLeft }));
  }

  private _onCloseBottomLeft = () => {
    this.setState((_prevState) => ({ showBottomLeft: false }));
  }

  private _toggleBottom = () => {
    this.setState((_prevState) => ({ showBottom: !this.state.showBottom }));
  }

  private _onCloseBottom = () => {
    this.setState((_prevState) => ({ showBottom: false }));
  }

  private _toggleBottomRight = () => {
    this.setState((_prevState) => ({ showBottomRight: !this.state.showBottomRight }));
  }

  private _onCloseBottomRight = () => {
    this.setState((_prevState) => ({ showBottomRight: false }));
  }

  private _toggleLeft = () => {
    this.setState((_prevState) => ({ showLeft: !this.state.showLeft }));
  }

  private _onCloseLeft = () => {
    this.setState((_prevState) => ({ showLeft: false }));
  }

  private _toggleRight = () => {
    this.setState((_prevState) => ({ showRight: !this.state.showRight }));
  }

  private _onCloseRight = () => {
    this.setState((_prevState) => ({ showRight: false }));
  }

  private _onArrowChange = () => {
    this.setState((_prevState) => ({ showArrow: !this.state.showArrow }));
  }

  private _onShadowChange = () => {
    this.setState((_prevState) => ({ showShadow: !this.state.showShadow }));
  }

  private _onStatusBarChange = () => {
    this.setState((_prevState) => ({ showStatusBarColors: !this.state.showStatusBarColors }));
  }

  private _onHoverChange = () => {
    this.setState((_prevState) => ({ onHover: !this.state.onHover }));
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  }

  private renderPopup(title: string, onClose: () => any) {
    return (
      <div className="popup-test-content">
        <h4>{title}</h4>
        <div />
        <ul>
          <li onClick={onClose}>Item 1</li>
          <li onClick={onClose}>Item 2</li>
          <li onClick={onClose}>Item 3</li>
          <li onClick={onClose}>Item 4</li>
        </ul>
      </div>
    );
  }
  public render() {
    const className = classnames("popupcolors", this.state.showStatusBarColors && "statusbarcolors");
    return (
      <div className="modal-background2 fade-in-fast">
        <div className="popup-test" >
          <div className="popup-header">
            <h3>Popups</h3>
            <span onClick={this._onClose} className="close icon icon-close" title="Close" />
          </div>
          <div className="popup-content">
            <div className="buttons">
              <div>
                <button onClick={this._toggleTopLeft}>
                  Top Left
                </button>
                <Popup className={className} isShown={this.state.showTopLeft} position={Position.TopLeft}
                  onClose={this._closeTopLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Top Left", this._closeTopLeft)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleTop}>
                  Top
                </button>
                <Popup className={className} isShown={this.state.showTop} position={Position.Top} onClose={this._closeTop}
                  showArrow={this.state.showArrow} showShadow={this.state.showShadow} showOnHover={this.state.onHover}>
                  {this.renderPopup("Top Center", this._closeTop)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleTopRight}>
                  Top Right
                </button>
                <Popup className={className} isShown={this.state.showTopRight} position={Position.TopRight}
                  onClose={this._onCloseTopRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Top Right", this._onCloseTopRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <button onClick={this._toggleLeft}>
                  Left
                </button>
                <Popup className={className} isShown={this.state.showLeft} position={Position.Left}
                  onClose={this._onCloseLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Left Center", this._onCloseLeft)}
                </Popup>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button onClick={this._toggleRight}>
                  Right
                </button>
                <Popup className={className} isShown={this.state.showRight} position={Position.Right}
                  onClose={this._onCloseRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Right Center", this._onCloseRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <button onClick={this._toggleBottomLeft}>
                  Bottom Left
                </button>
                <Popup className={className} isShown={this.state.showBottomLeft} position={Position.BottomLeft}
                  onClose={this._onCloseBottomLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Bottom Left", this._onCloseBottomLeft)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleBottom}>
                  Bottom
                </button>
                <Popup className={className} isShown={this.state.showBottom} position={Position.Bottom}
                  onClose={this._onCloseBottom} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Bottom Center", this._onCloseBottom)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleBottomRight}>
                  Bottom Right
                </button>
                <Popup className={className} isShown={this.state.showBottomRight} position={Position.BottomRight}
                  onClose={this._onCloseBottomRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}
                  showOnHover={this.state.onHover}>
                  {this.renderPopup("Bottom Right", this._onCloseBottomRight)}
                </Popup>
              </div>
            </div>
          </div>
          <div className="options">
            <div>
              <label>Arrow</label>
              <Toggle className="popup-toggle" onChange={this._onArrowChange} isOn={this.state.showArrow} />
            </div>
            <div>
              <label>Shadow</label>
              <Toggle className="popup-toggle" onChange={this._onShadowChange} isOn={this.state.showShadow} />
            </div>
            <div>
              <label>Hover</label>
              <Toggle className="popup-toggle" onChange={this._onHoverChange} isOn={this.state.onHover} />
            </div>
            <div>
              <label>Status Bar Colors</label>
              <Toggle className="popup-toggle" onChange={this._onStatusBarChange} isOn={this.state.showStatusBarColors} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
