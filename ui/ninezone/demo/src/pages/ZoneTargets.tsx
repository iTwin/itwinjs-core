/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Container from "@src/zones/target/Container";
import Merge from "@src/zones/target/Merge";
import Back from "@src/zones/target/Back";

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
};

const container: React.CSSProperties = {
  backgroundColor: "#EEE",
};

export default class ZoneTargets extends React.Component<{}> {
  public render() {
    return (
      <div style={root}>
        <div style={col}>
          <Container style={container}>
            <Merge />
          </Container>
        </div>
        <div style={col}>
          <Container style={container}>
            <Back zoneIndex={9} />
          </Container>
        </div>
      </div>
    );
  }
}
