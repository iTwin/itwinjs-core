/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as classnames from "classnames";
import * as React from "react";
import { HistoryItem, HistoryItemProps } from "./Item";
import "./Icon.scss";

// tslint:disable: deprecation

/** History item with icon. Used in [[HistoryTray]] component.
 * @note See [[HistoryItem]] for basic history item.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export class HistoryIcon extends React.PureComponent<HistoryItemProps> { // tslint:disable-line: deprecation
  public render() {
    const { className, ...props } = this.props;
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-history-icon",
      className);

    return (
      <HistoryItem // tslint:disable-line: deprecation
        className={itemClassName}
        {...props}
      >
        {this.props.children}

      </HistoryItem> // tslint:disable-line: deprecation
    );
  }
}
