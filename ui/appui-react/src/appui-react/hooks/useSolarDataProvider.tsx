/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";
import type { SolarDataProvider } from "@itwin/imodel-components-react";
import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { SolarTimelineDataProvider } from "../timeline/SolarTimelineDataProvider";

/** @internal */
// istanbul ignore next
function useSupportsShadowDisplay(viewport: ScreenViewport | undefined) {
  const [supportsShadows, setSupportsShadows] = React.useState(!!viewport?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);

  React.useEffect(() => {
    setSupportsShadows(!!viewport?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      setSupportsShadows(!!vp?.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [viewport]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const wantShadows = !!vp.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows;
      if (wantShadows !== supportsShadows)
        setSupportsShadows(wantShadows);
    };
    return viewport?.onChangeView.addListener(handleViewChanged);
  }, [viewport, supportsShadows]);

  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport): void => {
      const wantShadows = !!vp.displayStyle?.wantShadows && !!IModelApp.renderSystem.options.displaySolarShadows;
      if (wantShadows !== supportsShadows)
        setSupportsShadows(wantShadows);
    };
    return viewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
  }, [viewport, supportsShadows]);

  return supportsShadows;
}

/** Hook that returns either a SolarTimelineDataProvider or undefined based on if the supplied viewport's display style is set to display shadows.
 * @beta
 **/
// istanbul ignore next
export function useSolarDataProvider(viewport: ScreenViewport | undefined): SolarDataProvider | undefined {
  const supportsShadowDisplay = useSupportsShadowDisplay(viewport);
  const [solarDataProvider, setSolarDataProvider] = React.useState(() => {
    return (supportsShadowDisplay && viewport) ? new SolarTimelineDataProvider(viewport.view, viewport) : undefined;
  });

  React.useEffect(() => {
    const newSolarDataProvider = (supportsShadowDisplay && viewport) ? new SolarTimelineDataProvider(viewport.view, viewport) : undefined;
    setSolarDataProvider(newSolarDataProvider);
  }, [supportsShadowDisplay, viewport]);

  return solarDataProvider;
}
