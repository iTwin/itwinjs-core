/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import {
  UiFramework,
} from "@itwin/appui-react";
import { Logger } from "@itwin/core-bentley";
import { Cartographic, ColorDef, RenderMode } from "@itwin/core-common";
import { BlankConnection, IModelApp, IModelConnection, SpatialViewState } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { SampleAppIModelApp } from "..";

export async function openBlankConnection() {
  // Close the current iModelConnection
  await SampleAppIModelApp.closeCurrentIModel();

  // Open the connection
  Logger.logInfo(SampleAppIModelApp.loggerCategory(openBlankConnection), `openBlankConnection: Opening blank connection.`);
  const connection = createBlankConnection();

  SampleAppIModelApp.setIsIModelLocal(true, true);
  const viewState = await createBlankViewState(connection);
  UiFramework.setDefaultViewState(viewState, true);

  UiFramework.frontstages.closeModalFrontstage();
  await SampleAppIModelApp.setViewIdAndOpenMainStage(connection, [viewState.id]);
}

function createBlankConnection() {
  return BlankConnection.create({
    name: "Exton PA",
    location: Cartographic.fromDegrees({longitude: -75.686694, latitude: 40.065757, height: 0}),
    extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
  });
}

async function createBlankViewState(iModel: IModelConnection) {
  const ext = iModel.projectExtents;
  const viewState = SpatialViewState.createBlank(
    iModel,
    ext.low,
    ext.high.minus(ext.low)
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });

  return viewState;
}
