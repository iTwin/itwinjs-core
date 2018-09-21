/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import BackButton from "@bentley/ui-ninezone/lib/toolbar/button/Back";
import "./ModalFrontstage.scss";

// TODO - connect to Redux

/**
 * Props for ModalFrontstage React component
 */
export interface ModalFrontstageProps {
  /** Title displayed at the top of the modal Frontstage */
  title: string;
  /** Indicates whether the modal Frontstage is open */
  isOpen?: boolean;
  /** Callback for navigating back from the modal Frontstage. This is normally connected to Redux. */
  navigateBack: () => any;
  /** Callback for closing the modal Frontstage. This is normally connected to Redux. */
  closeModal: () => any;
  /** An optional React node displayed in the upper right of the modal Frontstage. */
  appBarRight?: React.ReactNode;
}

/**
 * ModalFrontstage React component
 */
export class ModalFrontstage extends React.Component<ModalFrontstageProps> {
  private _onGoBack = () => {
    this.props.navigateBack();
    this.props.closeModal();
  }

  public render() {
    const openClass = (this.props.isOpen) ? " open" : "";

    return (
      <>
        <div className={"modal-frontstage" + openClass}>
          <div className="app-bar">
            <BackButton
              onClick={this._onGoBack}
              icon={
                <i className="icon icon-progress-backward-2" />
              }
            />
            <span className="bwc-text-headline">{this.props.title}</span>
            {this.props.appBarRight &&
              <span className="app-bar-right">{this.props.appBarRight}</span>
            }
          </div>
          <div className="modal-content">
            {this.props.children}
          </div>
        </div>
        <div className="modal-frontstage-overlay" />
      </>
    );
  }
}
