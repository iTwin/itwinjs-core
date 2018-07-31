/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Container from "@src/zones/target/Container";
import Merge from "@src/zones/target/Merge";
import Unmerge, { CellType } from "@src/zones/target/Unmerge";

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
          <Merge
            rows={4}
            columns={6}
            cells={[]}
          />
        </div>
        <div style={col}>
          <Container style={container}>
            <Merge
              rows={4}
              columns={4}
              cells={[
                { row: 0, col: 0 },
                { row: 1, col: 1 },
                { row: 2, col: 2 },
                { row: 3, col: 3 },
              ]}
            />
          </Container>
        </div>
        <div style={col}>
          <Container style={container}>
            <Merge
              rows={5}
              columns={6}
              cells={[
                { row: 0, col: 0 },
                { row: 0, col: 5 },
                { row: 4, col: 0 },
                { row: 4, col: 5 },
              ]}
            />
            <Merge
              rows={5}
              columns={6}
              cells={[
                { row: 1, col: 1 },
                { row: 1, col: 4 },
                { row: 3, col: 1 },
                { row: 3, col: 4 },
              ]}
            />
            <Merge
              rows={5}
              columns={6}
              cells={[
                { row: 2, col: 2 },
                { row: 2, col: 3 },
              ]}
            />
          </Container>
        </div>
        <div style={col}>
          <Unmerge
            rows={3}
            columns={3}
            cells={[
              { row: 0, col: 0, type: CellType.Unmerge },
              { row: 1, col: 0, type: CellType.Unmerge },
              { row: 2, col: 0, type: CellType.Unmerge },
              { row: 0, col: 1, type: CellType.Unmerge },
              { row: 1, col: 1, type: CellType.Merge },
              { row: 2, col: 1, type: CellType.Merge },
              { row: 0, col: 2, type: CellType.Unmerge },
              { row: 1, col: 2, type: CellType.Unmerge },
              { row: 2, col: 2, type: CellType.Unmerge },
            ]}
          />
        </div>
      </div>
    );
  }
}
