/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  StagePanelType,
  BackTarget,
  MergeTarget,
  SplitterTarget,
  StagePanelTarget,
} from "@bentley/ui-ninezone";

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
