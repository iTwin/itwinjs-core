/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { StagePanels } from "@itwin/appui-layout-react";

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
