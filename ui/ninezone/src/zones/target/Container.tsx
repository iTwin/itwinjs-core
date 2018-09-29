/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Container.scss";

/** Properties of [[Container]] component. */
export interface ContainerProps extends CommonProps {
  /** Zone target. I.e. [[Back]], [[Merge]] */
  children?: React.ReactNode;
}

/** Container for zone targets. */
// tslint:disable-next-line:variable-name
export const Container: React.StatelessComponent<ContainerProps> = (props: ContainerProps) => {
  const className = classnames(
    "nz-zones-target-container",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
};

export default Container;
