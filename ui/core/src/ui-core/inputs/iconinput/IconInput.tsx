/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Input, InputProps } from "../Input";

import "./IconInput.scss";

/** Properties for the [[IconInput]] component
 * @alpha
 */
export interface IconInputProps extends InputProps {
  /** Icon displayed to the left of the Input field within the IconInput component */
  icon: React.ReactNode;
  /** CSS class name for the IconInput component container div */
  containerClassName?: string;
}

/** Input component with icon to the left of the input field
 * @alpha
 */
export class IconInput extends React.PureComponent<IconInputProps> {
  public render(): JSX.Element {
    const { icon, containerClassName, ...props } = this.props;
    return (
      <div className={classnames("core-iconInput-container", containerClassName)} >
        <Input {...props} />
        <div className="core-iconInput-icon">
          {icon}
        </div>
      </div>
    );
  }
}
