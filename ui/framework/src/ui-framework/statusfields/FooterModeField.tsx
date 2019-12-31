/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";

import { StatusFieldProps } from "./StatusFieldProps";
import { ConditionalField } from "./ConditionalField";
import { withStatusFieldProps } from "../statusbar/withStatusFieldProps";

// tslint:disable-next-line: variable-name
const ConditionalFieldWithProps = withStatusFieldProps(ConditionalField);

/**
 * A component that renders its children if the StatusBar is in Footer mode.
 * @public
 */
export class FooterModeField extends React.PureComponent<StatusFieldProps> {

  public render(): React.ReactNode {
    const { children, ...otherProps } = this.props as any;

    return (
      <ConditionalFieldWithProps {...otherProps} boolFunc={(props: StatusFieldProps): boolean => props.isInFooterMode} >
        {(isInFooterMode: boolean) => isInFooterMode && children}
      </ConditionalFieldWithProps>
    );
  }
}
