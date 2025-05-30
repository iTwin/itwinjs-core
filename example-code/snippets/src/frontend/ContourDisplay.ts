/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set } from "@itwin/core-bentley";
import { ColorDef, ContourDisplay, ContourDisplayProps, LinePixels, RgbColor } from "@itwin/core-common";
import { Viewport, ViewState } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ Setup_ContourDisplay

/** Configure and enable contour display on a viewport. */
export function setupContourDisplay(viewport: Viewport): boolean {
  const isContourDisplaySupported = (vw: ViewState) => vw.is3d();

  const view = viewport.view;

  if (!isContourDisplaySupported(view))
    return false; // Contour display settings are only valid for 3d views

  // Create a ContourDisplay object with the desired contour settings
  const contourDisplayProps: ContourDisplayProps = {
    displayContours: true, // this flag must be set to true in order to see any contours in the view
    groups: [ // the list of style groupings, each associated with a possible list of subcategories
      {
        contourDef: {
          showGeometry: true, // when true, this means the contours AND the underlying geometry will render
          majorStyle: {
            color: RgbColor.fromColorDef(ColorDef.red),
            pixelWidth: 3,
            pattern: LinePixels.Solid,
          },
          minorStyle: {
            color: RgbColor.fromColorDef(ColorDef.blue),
            pixelWidth: 1,
            pattern: LinePixels.Code3,
          },
          minorInterval: 2,
          majorIntervalCount: 8,
        },
        subCategories: CompressedId64Set.sortAndCompress([ "0x5b", "0x5a" ]),
      },
      {
        contourDef: {
          showGeometry: false, // when false, this means only the contours will render (and not the underlying geometry)
          majorStyle: {
            color: RgbColor.fromColorDef(ColorDef.black),
            pixelWidth: 4,
            pattern: LinePixels.Code4,
          },
          minorStyle: {
            color: RgbColor.fromColorDef(ColorDef.white),
            pixelWidth: 2,
            pattern: LinePixels.Solid,
          },
          minorInterval: 1,
          majorIntervalCount: 7,
        },
        subCategories: CompressedId64Set.sortAndCompress([ "0x5c", "0x6a" ]),
      },
    ],
  };

  // Create a ContourDisplay object using the props created above
  const contourDisplay = ContourDisplay.fromJSON(contourDisplayProps);

  // Change the contours object on the 3d display style state to contain the new object
  view.getDisplayStyle3d().settings.contours = contourDisplay;

  // Sync the viewport with the new view state
  viewport.synchWithView();

  return true;
}

// __PUBLISH_EXTRACT_END__;
