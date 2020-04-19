/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ExpandableBlock, ExpandableBlockProps } from "@bentley/ui-core";

/** Sample component using ExpandableBlock with an expanded state  */
// tslint:disable-next-line:variable-name
export const SampleExpandableBlock: React.FC<ExpandableBlockProps> = (props: ExpandableBlockProps) => {
  const [expanded, setExpanded] = React.useState(true);

  const _handleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
    setExpanded(!expanded);

    props.onClick && props.onClick(event);
  };

  return (
    <ExpandableBlock {...props} isExpanded={expanded} onClick={_handleClick} />
  );
};
