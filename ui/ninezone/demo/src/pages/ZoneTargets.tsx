/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { MergeTarget } from "@src/zones/target/Merge";
import { BackTarget } from "@src/zones/target/Back";
import { SplitterTarget } from "@src/zones/target/Splitter";
import { StagePanelTarget } from "@src/zones/target/StagePanel";
import { StagePanelType } from "@src/stage-panels/StagePanel";

const col: React.CSSProperties = {
  gridRow: "1",
  width: "100%",
  height: "100%",
  backgroundColor: "#EEE",
};

export default class ZoneTargets extends React.PureComponent<{}> {
  public render() {
    return (
      <div style={{
        display: "grid",
        justifyItems: "center",
        alignItems: "center",
        height: "100%",
        gridAutoColumns: "1fr 1fr 1fr auto",
        gridAutoRows: "100%",
        gridGap: "10px",
      }}>
        <div style={{
          ...col,
          position: "relative",
        }}>
          <SplitterTarget isVertical={false} paneCount={2} />
        </div>
        <div style={col}>
          <MergeTarget />
        </div>
        <div style={col}>
          <BackTarget zoneIndex={9} />
        </div>
        <div style={col}>
          <StagePanelTarget type={StagePanelType.Right} />
        </div>
      </div>
    );
  }
}
