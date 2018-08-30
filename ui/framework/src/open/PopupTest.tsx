/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import "./Common.scss";
import "./PopupTest.scss";
import { Popup, Position } from "./Popup";
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
  showStatusBarColors: boolean;
}

export class PopupTest extends React.Component<PopupTestProps, PopupTestState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { showTopLeft: false, showTop: false, showTopRight: false, showBottomLeft: false, showBottom: false, showBottomRight: false,
      showArrow: false, showStatusBarColors: false, showLeft: false, showRight: false };
  }

  private _handleTopLeft = () => {
    this.setState((_prevState) => ({ showTopLeft: false }));
  }

  private _onTopLeftClose = () => {
    this.setState((_prevState) => ({ showTopLeft: true }));
  }

  private _handleTop = () => {
    this.setState((_prevState) => ({ showTop: false }));
  }

  private _onTopClose = () => {
    this.setState((_prevState) => ({ showTop: true }));
  }

  private _handleTopRight = () => {
    this.setState((_prevState) => ({ showTopRight: false }));
  }

  private _onTopRightClose = () => {
    this.setState((_prevState) => ({ showTopRight: true }));
  }

  private _handleBottomLeft = () => {
    this.setState((_prevState) => ({ showBottomLeft: false }));
  }

  private _onBottomLeftClose = () => {
    this.setState((_prevState) => ({ showBottomLeft: true }));
  }

  private _handleBottom = () => {
    this.setState((_prevState) => ({ showBottom: false }));
  }

  private _onBottomClose = () => {
    this.setState((_prevState) => ({ showBottom: true }));
  }

  private _handleBottomRight = () => {
    this.setState((_prevState) => ({ showBottomRight: false }));
  }

  private _onBottomRightClose = () => {
    this.setState((_prevState) => ({ showBottomRight: true }));
  }

  private _handleLeft = () => {
    this.setState((_prevState) => ({ showLeft: false }));
  }

  private _onLeftClose = () => {
    this.setState((_prevState) => ({ showLeft: true }));
  }

  private _handleRight = () => {
    this.setState((_prevState) => ({ showRight: false }));
  }

  private _onRightClose = () => {
    this.setState((_prevState) => ({ showRight: true }));
  }

  private _onArrowChange = () => {
    this.setState((_prevState) => ({ showArrow: !this.state.showArrow }));
  }

  private _onStatusBarChange = () => {
    this.setState((_prevState) => ({ showStatusBarColors: !this.state.showStatusBarColors }));
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
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
            <button onClick={this._onTopLeftClose}>
              Top Left
              <Popup className={className} isShown={this.state.showTopLeft} position={Position.TopLeft} onClose={this._handleTopLeft} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
            <button onClick={this._onTopClose}>
              Top
              <Popup className={className} isShown={this.state.showTop} position={Position.Top} onClose={this._handleTop} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
            <button onClick={this._onTopRightClose}>
              Top Right
              <Popup className={className} isShown={this.state.showTopRight} position={Position.TopRight} onClose={this._handleTopRight} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
          </div>
          <div className="buttons">
            <button onClick={this._onLeftClose}>
              Left
              <Popup className={className} isShown={this.state.showLeft} position={Position.Left} onClose={this._handleLeft} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
            <button onClick={this._onRightClose} style={{ marginLeft: "auto" }}>
              Right
              <Popup className={className} isShown={this.state.showRight} position={Position.Right} onClose={this._handleRight} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
          </div>
          <div className="buttons">
            <button onClick={this._onBottomLeftClose}>
              Bottom Left
              <Popup className={className} isShown={this.state.showBottomLeft} position={Position.BottomLeft} onClose={this._handleBottomLeft} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
            <button onClick={this._onBottomClose}>
              Bottom
              <Popup className={className} isShown={this.state.showBottom} position={Position.Bottom} onClose={this._handleBottom} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
            <button onClick={this._onBottomRightClose}>
              Bottom Right
              <Popup className={className} isShown={this.state.showBottomRight} position={Position.BottomRight} onClose={this._handleBottomRight} showArrow={this.state.showArrow}>
                <h4 className="hello">Hello World</h4>
              </Popup>
            </button>
          </div>
          </div>
          <div className="options">
            <label>Show Arrow</label>
            <Toggle onChange={this._onArrowChange} />
            <label style={{marginLeft: "30px"}}>Status Bar Colors</label>
            <Toggle onChange={this._onStatusBarChange} />
        </div>
        </div>
      </div>
    );
  }
}
