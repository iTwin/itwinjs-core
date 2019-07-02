/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { StagePanels } from "@src/stage-panels/StagePanels";

export default class StagePanelsPage extends React.PureComponent {
  public render() {
    return (
      <StagePanels
        bottomPanel={<div style={{ backgroundColor: "brown" }}>Bottom Most</div>}
        topPanel={<div style={{ backgroundColor: "yellowgreen" }}>Top Most</div>}
      >
        <StagePanels
          leftPanel={<div style={{ backgroundColor: "green", height: "100%" }}>Left1</div>}
        >
          <StagePanels
            bottomPanel={<div style={{ backgroundColor: "sandybrown" }}>Bottom</div>}
            leftPanel={<div style={{ backgroundColor: "darkgreen", height: "100%" }}>Left2</div>}
            rightPanel={<div style={{ backgroundColor: "blue", height: "100%" }}>Right</div>}
            topPanel={<div style={{ backgroundColor: "yellow" }}>Top</div>}
          >
            Content
          </StagePanels>
        </StagePanels>
      </StagePanels>
    );
  }
}
