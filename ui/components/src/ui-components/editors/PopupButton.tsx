/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyEditors
 */

import "./PopupButton.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@bentley/ui-abstract";
import { Button, ButtonType, CommonDivProps, CommonProps, Div, Icon, Popup, UiCore } from "@bentley/ui-core";

/** Properties for [[PopupButton]] component
 * @alpha
 */
export interface PopupButtonProps extends CommonProps {
  /** Label to display in click area. */
  label: string | React.ReactNode;
  /** Contents of the popup */
  children: React.ReactNode;

  /** Show or hide the box shadow (defaults to false) */
  showShadow?: boolean;
  /** Show or hide the arrow (defaults to false) */
  showArrow?: boolean;

  /** Listens for click events on button area */
  onClick?: (event: React.MouseEvent) => void;
  /** Listens for popup close events */
  onClose?: () => void;
  /** Listens for Enter key in popup */
  onEnter?: () => void;
}

/** @internal */
interface PopupButtonState {
  showPopup: boolean;
}

/** PopupButton React component that is a button and property editor popup host
 * @alpha
 */
export class PopupButton extends React.PureComponent<PopupButtonProps, PopupButtonState> {
  private _targetPopup: HTMLElement | null = null;

  /** @internal */
  public readonly state: Readonly<PopupButtonState> = {
    showPopup: false,
  };

  /** @internal */
  public componentDidMount() {
  }

  /** @internal */
  public componentWillUnmount() {
  }

  private _togglePopup = (event: React.MouseEvent) => {
    this.setState(
      (prevState) => ({ showPopup: !prevState.showPopup }),
      () => this.props.onClick && this.props.onClick(event));
  }

  private _closePopup = () => {
    this.setState(
      { showPopup: false },
      () => this.props.onClose && this.props.onClose());
  }

  /** @internal */
  public render(): React.ReactNode {
    const showArrow = this.props.showArrow ?? false;
    const showShadow = this.props.showShadow ?? false;

    return (
      <div className={this.props.className}>
        <div className="components-popup-button"
          onClick={this._togglePopup} ref={(element) => { this._targetPopup = element; }}
          data-testid="components-popup-button"
        >
          <div className="components-popup-button-value">
            {this.props.label}
          </div>
          <div className={"components-popup-button-arrow"} tabIndex={0}>
            <div className={classnames("components-popup-button-arrow-icon", "icon", "icon-chevron-down")} />
          </div>
        </div>
        <Popup className="components-popup-button-popup" isOpen={this.state.showPopup} position={RelativePosition.Bottom}
          onClose={this._closePopup} onEnter={this.props.onEnter} target={this._targetPopup}
          showArrow={showArrow} showShadow={showShadow}
        >
          {this.props.children}
        </Popup>
      </div>

    );
  }
}

/** Popup content with padding
 * @alpha
 */
export function PopupContent(props: CommonDivProps) {
  return <Div {...props} mainClassName="components-editor-popup-content" />;
}

/** Properties for [[PopupOkCancelButtons]] component
 * @alpha
 */
export interface OkCancelProps {
  onOk: (event: React.MouseEvent) => void;
  onCancel: (event: React.MouseEvent) => void;
}

/** OK/Cancel Buttons
 * @alpha
 */
export function PopupOkCancelButtons(props: OkCancelProps) {
  return (
    <div className="components-popup-bottom-buttons">
      <Button
        className={classnames("components-popup-large-button", "components-popup-cancel-button")}
        title={UiCore.translate("dialog.cancel")}
        onClick={props.onCancel}
      >
        <Icon iconSpec="icon-remove" />
      </Button>
      <Button
        className={classnames("components-popup-large-button", "components-popup-ok-button")}
        data-testid="components-popup-ok-button"
        buttonType={ButtonType.Primary}
        title={UiCore.translate("dialog.ok")}
        onClick={props.onOk}
      >
        <Icon iconSpec="icon-checkmark" />
      </Button>
    </div>
  );
}
