/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { MergeTarget } from "@src/zones/target/Merge";
import { BackTarget } from "@src/zones/target/Back";

const root: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignItems: "center",
  height: "100%",
  gridAutoColumns: "1fr",
  gridAutoRows: "100%",
  gridGap: "10px",
};

const col: React.CSSProperties = {
  gridRow: "1",
  width: "100%",
  height: "100%",
  position: "relative",
  backgroundColor: "#EEE",
};

export default class ZoneTargets extends React.PureComponent<{}> {
  public render() {
    return (
      <div style={root}>
        <div style={col}>
          <MergeTarget />
        </div>
        <div style={col}>
          <BackTarget zoneIndex={9} />
        </div>
      </div>
    );
  }
}
