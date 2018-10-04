/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import * as classnames from "classnames";
import "./ApplicationHeader.scss";

/** Props for the ApplicationHeader React component */
export interface ApplicationHeaderProps {
  icon: React.ReactNode;
  message: string;
  headerClassName?: string;
  messageClassName?: string;
}

/**
 * ApplicationHeader React component used as a header on the iModel and Project selectors.
 */
export class ApplicationHeader extends React.Component<ApplicationHeaderProps> {

  private constructor(props: ApplicationHeaderProps) {
    super(props);
  }

  public render(): JSX.Element | undefined {
    const headerClassName = classnames("fw-application-header", this.props.headerClassName);
    const messageClassName = classnames("fw-application-message", this.props.messageClassName);

    return (
      <div className={headerClassName}>
        {this.props.icon}
        <span className={messageClassName}>
          {this.props.message}
        </span>
      </div>
    );
  }

}
