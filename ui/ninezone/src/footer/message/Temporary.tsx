/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Temporary.scss";

/** Properties of [[Temporary]] component. */
export interface TemporaryProps extends CommonProps {
  /** Message content. */
  children?: React.ReactNode;
}

/** Temporary message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
// tslint:disable-next-line:variable-name
export const Temporary: React.StatelessComponent<TemporaryProps> = (props) => {
  const className = classnames(
    "nz-footer-message-temporary",
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

export default Temporary;
