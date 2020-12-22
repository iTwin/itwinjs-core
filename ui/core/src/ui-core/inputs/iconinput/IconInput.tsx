/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import "./IconInput.scss";
import classnames from "classnames";
import * as React from "react";
import { Input, InputProps } from "../Input";

/** Properties for the [[IconInput]] component
 * @public
 */
export interface IconInputProps extends InputProps {
  /** Icon displayed to the left of the Input field within the IconInput component */
  icon: React.ReactNode;
  /** CSS class name for the IconInput component container div */
  containerClassName?: string;
}

/** Input component with icon to the left of the input field
 * @public
 */
export function IconInput(props: IconInputProps) {
  const { icon, containerClassName, ...otherProps } = props;

  return (
    <div className={classnames("core-iconInput-container", containerClassName)} >
      <Input {...otherProps} />
      <div className="core-iconInput-icon">
        {icon}
      </div>
    </div>
  );
}
