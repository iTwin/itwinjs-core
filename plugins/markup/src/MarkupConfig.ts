/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:variable-name
export let MarkupProps = {
  handles: {
    size: 9,
    color: "white",
    stretch: { "fill-opacity": .85, "stroke": "grey", "fill": "white" },
    rotateLine: { "stroke": "grey", "fill-opacity": .85 },
    rotate: { "cursor": "url(Markup/rotate.png) 12 12, auto", "fill-opacity": .85, "stroke": "black", "fill": "lightBlue" },
    move: { "cursor": "move", "stroke-dasharray": "6,6", "fill": "lightGrey", "fill-opacity": .1, "stroke-opacity": .85, "stroke": "white" },
  },
  hilite: {
    color: "magenta",
    flash: "cyan",
  },
  active: {
    text: {
      "font-family": "sans-serif",
      "font-size": "30px",
      "stroke": "red",
      "fill": "red",
    },
    element: {
      "stroke": "red",
      "stroke-opacity": 0.8,
      "stroke-width": 3,
      "fill-opacity": 0.2,
      "fill": "blue",
    },
  },
  text: {
    edit: {
      box: { "fill": "lightGrey", "fill-opacity": .1, "stroke-opacity": .85, "stroke": "lightBlue" },
    },
  },
};

export interface MarkupColor {
  fill: any;
  stroke: any;
}
