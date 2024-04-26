/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";

/** @internal */
export class RandomMapColor {
  private static readonly randomColorPalette = [
    "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e",
    "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac",
    "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4",
    "#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31c2c", "#fdbf6f", "#ff7f00", "#cab2d6",
    "#fbb4ae", "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff2000", "#ffff33", "#a65628", "#999999",
    "#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#ffa07a",
    "#b15928", "#6a3d9a", "#ffed6f", "#9e0142", "#5e4fa2", "#999900", "#1a9850", "#4d4d4d", "#6baed6",
    "#71c671", "#388e8e", "#7d9ec0", "#7171c6", "#8e388e", "#8e8e38", "#00c957", "#cc3333", "#d1dbdd",
  ];

  public getColor() {
    return RandomMapColor.randomColorPalette[ Math.floor(Math.random() * RandomMapColor.randomColorPalette.length)];
  }

  public getColorDef() {
    return ColorDef.fromString(this.getColor());
  }
}

