/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../../../../utilities/Props";
import "./Scrollable.scss";

/** Properties of [[ScrollableContent]] component. */
export interface ScrollableContentProps extends CommonProps, NoChildrenProps {
  /** Actual content. */
  content?: React.ReactNode;
}

/** Scrollable content of [[Dialog]] component. */
// tslint:disable-next-line:variable-name
export const ScrollableContent: React.StatelessComponent<ScrollableContentProps> = (props) => {
  const className = classnames(
    "nz-footer-message-content-dialog-content-scrollable",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-content">
        {props.content}
      </div>
    </div>
  );
};

export default ScrollableContent;
