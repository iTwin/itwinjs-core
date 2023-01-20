/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./PopupTest.scss";
import * as React from "react";
import { DialogButtonType, RelativePosition } from "@itwin/appui-abstract";
import { Dialog, Popup } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { Button, ToggleSwitch } from "@itwin/itwinui-react";

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
 * Test dialog for popups.
 * @internal
 */
export class PopupTestDialog extends React.Component<PopupTestProps, PopupTestState> {
  public override readonly state: Readonly<PopupTestState>;
  private _targetTop = React.createRef<HTMLButtonElement>();
  private _targetBottom = React.createRef<HTMLButtonElement>();
  private _targetLeft = React.createRef<HTMLButtonElement>();
  private _targetRight = React.createRef<HTMLButtonElement>();
  private _targetTopLeft = React.createRef<HTMLButtonElement>();
  private _targetTopRight = React.createRef<HTMLButtonElement>();
  private _targetBottomLeft = React.createRef<HTMLButtonElement>();
  private _targetBottomRight = React.createRef<HTMLButtonElement>();

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showTopLeft: false, showTop: false, showTopRight: false, showBottomLeft: false, showBottom: false, showBottomRight: false,
      showArrow: false, showLeft: false, showRight: false, showShadow: true, opened: this.props.opened,
    };
  }

  private _toggleTopLeft = () => {
    this.setState((prevState) => ({ showTopLeft: !prevState.showTopLeft }));
  };

  private _closeTopLeft = () => {
    this.setState({ showTopLeft: false });
  };

  private _toggleTop = () => {
    this.setState((prevState) => ({ showTop: !prevState.showTop }));
  };

  private _closeTop = () => {
    this.setState({ showTop: false });
  };

  private _toggleTopRight = () => {
    this.setState((prevState) => ({ showTopRight: !prevState.showTopRight }));
  };

  private _onCloseTopRight = () => {
    this.setState({ showTopRight: false });
  };

  private _toggleBottomLeft = () => {
    this.setState((prevState) => ({ showBottomLeft: !prevState.showBottomLeft }));
  };

  private _onCloseBottomLeft = () => {
    this.setState({ showBottomLeft: false });
  };

  private _toggleBottom = () => {
    this.setState((prevState) => ({ showBottom: !prevState.showBottom }));
  };

  private _onCloseBottom = () => {
    this.setState({ showBottom: false });
  };

  private _toggleBottomRight = () => {
    this.setState((prevState) => ({ showBottomRight: !prevState.showBottomRight }));
  };

  private _onCloseBottomRight = () => {
    this.setState({ showBottomRight: false });
  };

  private _toggleLeft = () => {
    this.setState((prevState) => ({ showLeft: !prevState.showLeft }));
  };

  private _onCloseLeft = () => {
    this.setState({ showLeft: false });
  };

  private _toggleRight = () => {
    this.setState((prevState) => ({ showRight: !prevState.showRight }));
  };

  private _onCloseRight = () => {
    this.setState({ showRight: false });
  };

  private _onArrowChange = () => {
    this.setState((prevState) => ({ showArrow: !prevState.showArrow }));
  };

  private _onShadowChange = () => {
    this.setState((prevState) => ({ showShadow: !prevState.showShadow }));
  };

  private _handleOK = () => {
    this._closeDialog();
  };

  private _handleCancel = () => {
    this._closeDialog();
  };

  private _closeDialog = () => {
    this.setState((_prevState) => ({
      opened: false,
    }), () => {
      if (!this.state.opened)
        UiFramework.dialogs.modal.closeDialog();
    });
  };

  private renderPopup(title: string, onClose: () => any) {
    return (
      <div className="popup-test-content">
        <h4>{title}</h4>
        <div />
        <ul>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <li onClick={onClose}>Item 1</li>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <li onClick={onClose}>Item 2</li>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <li onClick={onClose}>Item 3</li>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <li onClick={onClose}>Item 4</li>
        </ul>
      </div>
    );
  }
  public override render() {
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
                <Button onClick={this._toggleTopLeft} ref={this._targetTopLeft}>
                  Top Left
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showTopLeft} position={RelativePosition.TopLeft} onClose={this._closeTopLeft} target={this._targetTopLeft.current}
                  showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Left", this._closeTopLeft)}
                </Popup>
              </div>
              <div>
                <Button onClick={this._toggleTop} ref={this._targetTop}>
                  Top
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showTop} position={RelativePosition.Top} onClose={this._closeTop} target={this._targetTop.current}
                  showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Center", this._closeTop)}
                </Popup>
              </div>
              <div>
                <Button onClick={this._toggleTopRight} ref={this._targetTopRight}>
                  Top Right
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showTopRight} position={RelativePosition.TopRight} target={this._targetTopRight.current}
                  onClose={this._onCloseTopRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Top Right", this._onCloseTopRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <Button onClick={this._toggleLeft} ref={this._targetLeft}>
                  Left
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showLeft} position={RelativePosition.Left} target={this._targetLeft.current}
                  onClose={this._onCloseLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Left Center", this._onCloseLeft)}
                </Popup>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <Button onClick={this._toggleRight} ref={this._targetRight}>
                  Right
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showRight} position={RelativePosition.Right} target={this._targetRight.current}
                  onClose={this._onCloseRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Right Center", this._onCloseRight)}
                </Popup>
              </div>
            </div>
            <div className="buttons">
              <div>
                <Button onClick={this._toggleBottomLeft} ref={this._targetBottomLeft}>
                  Bottom Left
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showBottomLeft} position={RelativePosition.BottomLeft} target={this._targetBottomLeft.current}
                  onClose={this._onCloseBottomLeft} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Bottom Left", this._onCloseBottomLeft)}
                </Popup>
              </div>
              <div>
                <Button onClick={this._toggleBottom} ref={this._targetBottom}>
                  Bottom
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showBottom} position={RelativePosition.Bottom} target={this._targetBottom.current}
                  onClose={this._onCloseBottom} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Bottom Center", this._onCloseBottom)}
                </Popup>
              </div>
              <div>
                <Button onClick={this._toggleBottomRight} ref={this._targetBottomRight}>
                  Bottom Right
                </Button>
                <Popup className="popup-colors" isOpen={this.state.showBottomRight} position={RelativePosition.BottomRight} target={this._targetBottomRight.current}
                  onClose={this._onCloseBottomRight} showArrow={this.state.showArrow} showShadow={this.state.showShadow}>
                  {this.renderPopup("Bottom Right", this._onCloseBottomRight)}
                </Popup>
              </div>
            </div>
          </div>
          <div className="options">
            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label>Arrow</label>
              <ToggleSwitch className="popup-toggle" onChange={this._onArrowChange} checked={this.state.showArrow} />
            </div>
            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label>Shadow</label>
              <ToggleSwitch className="popup-toggle" onChange={this._onShadowChange} checked={this.state.showShadow} />
            </div>
          </div>
        </div>
      </Dialog>
    );
  }
}
