/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
          {!this.props.isPopoverOpen ? undefined :
            <Popover
              direction={Direction.Left}
            >
              <div style={contentCss} />
            </Popover>
          }
        </div>
        <div style={container}>
          Top
          {!this.props.isPopoverOpen ? undefined :
            <Popover
              direction={Direction.Top}
            >
              <div style={contentCss} />
            </Popover>
          }
        </div>
        <div style={container}>
          Right
          {!this.props.isPopoverOpen ? undefined :
            <Popover
              direction={Direction.Right}
            >
              <div style={contentCss} />
            </Popover>
          }
        </div>
        <div style={container}>
          Bottom
          <Popover
            direction={Direction.Bottom}
          >
            {!this.props.isPopoverOpen ? undefined :
              <div style={contentCss} />
            }
          </Popover>
        </div>
        <div style={containerRow2}>
          Left
          {!this.props.isPopoverOpen ? undefined :
            <TrianglePopover
              direction={Direction.Left}
              content={
                <div style={contentCss} />
              }
            />
          }
        </div>
        <div style={containerRow2}>
          Top
          {!this.props.isPopoverOpen ? undefined :
            <TrianglePopover
              direction={Direction.Top}
              content={
                <div style={contentCss} />
              }
            />
          }
        </div>
        <div style={containerRow2}>
          Right
          {!this.props.isPopoverOpen ? undefined :
            <TrianglePopover
              direction={Direction.Right}
              content={
                <div style={contentCss} />
              }
            />
          }
        </div>
        <div style={containerRow2}>
          Bottom
          {!this.props.isPopoverOpen ? undefined :
            <TrianglePopover
              direction={Direction.Bottom}
              content={
                <div style={contentCss} />
              }
            />
          }
        </div>
      </div>
    );
  }
}
