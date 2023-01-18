/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { StatusBarContext } from "../statusbar/StatusBar";
import { ConditionalField } from "./ConditionalField";
import { StatusFieldProps } from "./StatusFieldProps";

/** Properties for a FooterModeField component
 * @public
 */
export interface FooterModeFieldProps extends StatusFieldProps {
  /** Field content. */
  children?: React.ReactNode;
}

/**
 * A component that renders its children if the StatusBar is in Footer mode.
 * @public
 * @deprecated in 3.x. In upcoming version, widget mode will be removed, in footer mode will always be true, making this component useless.
 */
export function FooterModeField(props: FooterModeFieldProps) {
  const { children, ...otherProps } = props as any;
  const statusBarContext = React.useContext(StatusBarContext);
  const conditionProps = {...statusBarContext, ...otherProps};

  return (
  // eslint-disable-next-line deprecation/deprecation
    <ConditionalField {...conditionProps} boolFunc={(innerProps): boolean => innerProps.isInFooterMode} >
      {(isInFooterMode: boolean) => isInFooterMode && children}
    </ConditionalField>
  );
}
