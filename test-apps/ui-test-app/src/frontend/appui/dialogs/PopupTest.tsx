/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Popup, Position, Toggle, Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import "./PopupTest.scss";

interface PopupTestProps {
  opened: boolean;
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
  opened: boolean;
}

/**
 * Test for popups.  Do not use, ths will be removed!
 * @hidden
 */
export class PopupTestDialog extends React.Component<PopupTestProps, PopupTestState> {
  public readonly state: Readonly<PopupTestState>;
  private _targetTop: HTMLElement | null = null;
  private _targetBottom: HTMLElement | null = null;
  private _targetLeft: HTMLElement | null = null;
  private _targetRight: HTMLElement | null = null;
  private _targetTopLeft: HTMLElement | null = null;
  private _targetTopRight: HTMLElement | null = null;
  private _targetBottomLeft: HTMLElement | null = null;
  private _targetBottomRight: HTMLElement | null = null;

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showTopLeft: false, showTop: false, showTopRight: false, showBottomLeft: false, showBottom: false, showBottomRight: false,
      showArrow: false, showLeft: false, showRight: false, showShadow: true, opened: this.props.opened,
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

  private _handleOK = () => {
    this._closeDialog();
  }

  private _handleCancel = () => {
    this._closeDialog();
  }

  private _closeDialog = () => {
    this.setState((_prevState) => ({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeModalDialog();
    });
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
    return (
      <Dialog
        title={"Test Popups"}
        opened={this.state.opened}
        modal={true}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: () => { this._handleOK(); } },
          { type: DialogButtonType.Cancel, onClick: () => { this._handleCancel(); } },
        ]}
        onClose={() => this._handleCancel()}
        onEscape={() => this._handleCancel()}
      >
        <div className="popup-test" >
          <div className="popup-content">
            <div className="buttons">
              <div>
                <button onClick={this._toggleTopLeft} ref={(element) => { this._targetTopLeft = element; }}>
                  Top Left
                </button>
                <Popup className="popupcolors" isOpen={this.state.showTopLeft} position={Position.TopLeft} onClose={this._closeTopLeft} target={this._targetTopLeft}
                                  showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Left", this._closeTopLeft)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleTop} ref={(element) => { this._targetTop = element; }}>
                  Top
                </button>
                <Popup className="popupcolors" isOpen={this.state.showTop} position={Position.Top} onClose={this._closeTop} target={this._targetTop}
                  showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Center", this._closeTop)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleTopRight} ref={(element) => { this._targetTopRight = element; }}>
                  Top Right
                </button>
                <Popup className="popupcolors" isOpen={this.state.showTopRight} position={Position.TopRight} target={this._targetTopRight}
                  onClose={this._onCloseTopRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Right", this._onCloseTopRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <button onClick={this._toggleLeft} ref={(element) => { this._targetLeft = element; }}>
                  Left
                </button>
                <Popup className="popupcolors" isOpen={this.state.showLeft} position={Position.Left} target={this._targetLeft}
                  onClose={this._onCloseLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Left Center", this._onCloseLeft)}
                </Popup>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button onClick={this._toggleRight} ref={(element) => { this._targetRight = element; }}>
                  Right
                </button>
                <Popup className="popupcolors" isOpen={this.state.showRight} position={Position.Right} target={this._targetRight}
                  onClose={this._onCloseRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Right Center", this._onCloseRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <button onClick={this._toggleBottomLeft} ref={(element) => { this._targetBottomLeft = element; }}>
                  Bottom Left
                </button>
                <Popup className="popupcolors" isOpen={this.state.showBottomLeft} position={Position.BottomLeft} target={this._targetBottomLeft}
                  onClose={this._onCloseBottomLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Bottom Left", this._onCloseBottomLeft)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleBottom} ref={(element) => { this._targetBottom = element; }}>
                  Bottom
                </button>
                <Popup className="popupcolors" isOpen={this.state.showBottom} position={Position.Bottom} target={this._targetBottom}
                  onClose={this._onCloseBottom} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Bottom Center", this._onCloseBottom)}
                </Popup>
              </div>
              <div>
                <button onClick={this._toggleBottomRight} ref={(element) => { this._targetBottomRight = element; }}>
                  Bottom Right
                </button>
                <Popup className="popupcolors" isOpen={this.state.showBottomRight} position={Position.BottomRight} target={this._targetBottomRight}
                  onClose={this._onCloseBottomRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
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
          </div>
        </div>
      </Dialog>
    );
  }
}
