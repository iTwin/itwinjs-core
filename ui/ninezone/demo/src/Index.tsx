/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import Demo from "./Demo";
import "@bentley/bwc/lib/classes.scss";

ReactDOM.render(
  <Demo />,
  document.getElementById("demo") as HTMLElement,
);
