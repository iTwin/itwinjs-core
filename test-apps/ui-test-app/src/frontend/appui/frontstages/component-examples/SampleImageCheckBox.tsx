/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ImageCheckBox, ImageCheckBoxProps } from "@itwin/core-react";

/** Sample component using ImageCheckBox with a checked state  */
export const SampleImageCheckBox: React.FC<ImageCheckBoxProps> = (props: ImageCheckBoxProps) => {
  const [checked, setChecked] = React.useState(false);

  const handleClick = (targetChecked: boolean): any => {
    setChecked(targetChecked);

    props.onClick && props.onClick(targetChecked);
  };

  return (
    <ImageCheckBox {...props} checked={checked} onClick={handleClick} />
  );
};
