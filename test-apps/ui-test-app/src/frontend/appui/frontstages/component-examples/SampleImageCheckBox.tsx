/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ImageCheckBox, ImageCheckBoxProps } from "@bentley/ui-core";

/** Sample component using ImageCheckBox with a checked state  */
// tslint:disable-next-line:variable-name
export const SampleImageCheckBox: React.FC<ImageCheckBoxProps> = (props: ImageCheckBoxProps) => {
  const [checked, setChecked] = React.useState(false);

  const _handleClick = (targetChecked: boolean): any => {
    setChecked(targetChecked);

    props.onClick && props.onClick(targetChecked);
  };

  return (
    <ImageCheckBox {...props} checked={checked} onClick={_handleClick} />
  );
};
