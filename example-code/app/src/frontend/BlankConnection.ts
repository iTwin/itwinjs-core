/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Range3d } from "@itwin/core-geometry";
import { Cartographic, ColorDef } from "@itwin/core-common";
import { BlankConnection, IModelConnection, SpatialViewState } from "@itwin/core-frontend";

export class BlankConnectionExample {

  // __PUBLISH_EXTRACT_START__ BlankConnection.open

  // create a new blank connection centered on Exton PA
  public openBlankConnection() {
    const exton: BlankConnection = BlankConnection.create({
      // call this connection "Exton PA"
      name: "Exton PA",
      // put the center of the connection near Exton, Pennsylvania (Bentley's HQ)
      location: Cartographic.fromDegrees({longitude: -75.686694, latitude: 40.065757, height: 0}),
      // create the area-of-interest to be 2000 x 2000 x 200 meters, centered around 0,0.0
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
    });
    return exton;
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ CreateBlankView

  // create a new spatial view initialized to show the project extents from top view. Model and
  // category selectors are empty, so this is useful for showing backgroundMaps, reality models, terrain, etc.
  public createBlankView(iModel: IModelConnection): SpatialViewState {
    const ext = iModel.projectExtents;

    // start with a new "blank" spatial view to show the extents of the project, from top view
    const blankView = SpatialViewState.createBlank(iModel, ext.low, ext.high.minus(ext.low));

    // turn on the background map
    const style = blankView.displayStyle;
    style.viewFlags = style.viewFlags.with("backgroundMap", true);

    style.backgroundColor = ColorDef.white;

    // turn on the ground and skybox in the environment
    style.environment = style.environment.withDisplay({ sky: true, ground: true });

    return blankView;
  }
  // __PUBLISH_EXTRACT_END__
}
