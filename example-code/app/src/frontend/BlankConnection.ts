/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Range3d } from "@bentley/geometry-core";
import { Cartographic, ColorDef } from "@bentley/imodeljs-common";
import { BlankConnection, IModelConnection, SpatialViewState } from "@bentley/imodeljs-frontend";

export class BlankConnectionExample {

  // __PUBLISH_EXTRACT_START__ BlankConnection.open

  // create a new blank connection centered on Exton PA
  public openBlankConnection() {
    const exton: BlankConnection = BlankConnection.create({
      // call this connection "Exton PA"
      name: "Exton PA",
      // put the center of the connection near Exton, Pennsylvania (Bentley's HQ)
      location: Cartographic.fromDegrees(-75.686694, 40.065757, 0),
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
    const viewFlags = style.viewFlags;
    viewFlags.backgroundMap = true;
    style.viewFlags = viewFlags; // call to accessor to get the json properties to reflect the changes to ViewFlags

    style.backgroundColor = ColorDef.white;

    // turn on the ground and skybox in the environment
    const env = style.environment;
    env.ground.display = true;
    env.sky.display = true;
    style.environment = env; // call to accessor to get the json properties to reflect the changes

    return blankView;
  }
  // __PUBLISH_EXTRACT_END__
}
