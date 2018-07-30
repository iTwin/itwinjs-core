/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Popover from "@src/popup/popover/Popover";
import TrianglePopover from "@src/popup/popover/Triangle";
import Direction from "@src/utilities/Direction";

const root: React.CSSProperties = {
  alignItems: "center",
  display: "grid",
  gridTemplateRows: "300px",
  height: "600px",
  justifyItems: "center",
};

const container: React.CSSProperties = {
  backgroundColor: "black",
  color: "white",
  gridRow: "1",
  height: "60px",
  position: "relative",
  width: "30px",
};

const containerRow2 = Object.assign({}, container, {
  gridRow: "2",
} as React.CSSProperties);

const contentCss: React.CSSProperties = {
  backgroundColor: "red",
  height: "50px",
  width: "100px",
};

export interface Props {
  isPopoverOpen?: boolean;
}

export default class PopoversExample extends React.Component<Props> {
  public render() {
    return (
      <div style={root}>
        <div style={container}>
          Left
          <Popover
            direction={Direction.Left}
            isOpen={this.props.isPopoverOpen}
          >
            <div style={contentCss} />
          </Popover>
        </div>

        <div style={container}>
          Top
          <Popover
            direction={Direction.Top}
            isOpen={this.props.isPopoverOpen}
          >
            <div style={contentCss} />
          </Popover>
        </div>

        <div style={container}>
          Right
          <Popover
            direction={Direction.Right}
            isOpen={this.props.isPopoverOpen}
          >
            <div style={contentCss} />
          </Popover>
        </div>

        <div style={container}>
          Bottom
          <Popover
            direction={Direction.Bottom}
            isOpen={this.props.isPopoverOpen}
          >
            <div style={contentCss} />
          </Popover>
        </div>

        <div style={containerRow2}>
          Left
          <TrianglePopover
            direction={Direction.Left}
            isOpen={this.props.isPopoverOpen}
            content={
              <div style={contentCss} />
            }
          />
        </div>

        <div style={containerRow2}>
          Top
          <TrianglePopover
            direction={Direction.Top}
            isOpen={this.props.isPopoverOpen}
            content={
              <div style={contentCss} />
            }
          />
        </div>

        <div style={containerRow2}>
          Right
          <TrianglePopover
            direction={Direction.Right}
            isOpen={this.props.isPopoverOpen}
            content={
              <div style={contentCss} />
            }
          />
        </div>

        <div style={containerRow2}>
          Bottom
          <TrianglePopover
            direction={Direction.Bottom}
            isOpen={this.props.isPopoverOpen}
            content={
              <div style={contentCss} />
            }
          />
        </div>
      </div>
    );
  }
}
