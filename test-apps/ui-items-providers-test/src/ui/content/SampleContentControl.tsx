/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { ConfigurableCreateInfo, ContentControl } from "@itwin/appui-react";
import "./SampleContentControl.scss";

export class SampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = (
      <div className="ninezone-plugin-content-container">
        Hello World!
      </div>
    );
  }
}
