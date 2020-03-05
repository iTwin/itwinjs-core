/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps, useTargeted } from "@bentley/ui-core";
import "./BackArrow.scss";

/** Properties of [[BackArrow]] component.
 * @internal
 */
export interface BackArrowProps extends CommonProps, NoChildrenProps {
  /** Function called when arrow is clicked. */
  onClick?: () => void;
  /** Function called when pointer up event is received. */
  onPointerUp?: () => void;
}

/** Back arrow used in [[NestedGroup]] component.
 * @internal
 */
export const BackArrow = React.memo<React.FC<BackArrowProps>>( // tslint:disable-line: variable-name
  (props: BackArrowProps) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const targeted = useTargeted(ref);
    const className = classnames(
      "components-toolbar-item-expandable-group-backArrow",
      targeted && "components-targeted",
      props.className);
    return (
      <div
        className={className}
        onClick={props.onClick}
        onPointerUp={props.onPointerUp}
        ref={ref}
        style={props.style}
      />
    );
  });
