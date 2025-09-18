/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { ColorDef, DisplayStyle3dSettingsProps, RenderMode } from "@itwin/core-common";
import { StandardViewId } from "@itwin/core-frontend";
import { Viewer } from "./Viewer";
import { CesiumDecorator } from "@itwin/cesium-renderer";

export async function openEmptyExample(viewer: Viewer) {
  assert(viewer.viewport.view.is3d());
  viewer.viewport.setStandardRotation(StandardViewId.Iso);
  viewer.viewport.turnCameraOn();
  viewer.viewport.zoomToVolume(viewer.viewport.iModel.projectExtents);

  viewer.viewport.viewFlags = viewer.viewport.viewFlags.copy({
    renderMode: RenderMode.SmoothShade,
    lighting: true,
    visibleEdges: false,
    whiteOnWhiteReversal: false,
    backgroundMap: false,
  });

  const style: DisplayStyle3dSettingsProps = {
    backgroundColor: ColorDef.computeTbgrFromString("#0000ff"),
    environment: {
      sky: {
        display: false,
      },
    },
  };

  viewer.viewport.overrideDisplayStyle(style);
  // Start test decorations for Cesium prototype
  if (viewer.viewport.iModel) {
    const decorator = CesiumDecorator.start(viewer.viewport.iModel);

    // Clean up decorator when iModel closes
    viewer.viewport.iModel.onClose.addOnce(() => {
      decorator.stop();
    });
  }
}
