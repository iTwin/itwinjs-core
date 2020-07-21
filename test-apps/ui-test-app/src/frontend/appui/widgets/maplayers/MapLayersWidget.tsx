/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { ConfigurableCreateInfo, ConfigurableUiManager, useActiveViewport, WidgetControl } from "@bentley/ui-framework";
import { MapLayerManager } from "./MapLayerManager";
import { FillCentered } from "@bentley/ui-core";

/**
 * Manager Map Layers
 */
function MapLayersWidget() {
  const [notGeoLocatedMsg] = React.useState("Imodel must be geo-located to work with maps");
  const activeViewport = useActiveViewport();
  const ref = React.useRef<HTMLDivElement>(null);

  if (activeViewport && !!activeViewport?.iModel.isGeoLocated)
    return (
      <div ref={ref} className="map-manager-layer-host">
        <MapLayerManager activeViewport={activeViewport} getContainerForClone={() => {
          return ref.current ? ref.current : document.body;
        }} />
      </div>
    );

  return (

    <FillCentered><div className="map-manager-not-geo-located-text">{notGeoLocatedMsg}</div></FillCentered>
  );
}

/** MapLayersWidgetControl the provides a widget to attach and remove maps. */
export class MapLayersWidgetControl extends WidgetControl {
  public static id = "MapLayersWidget";
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <MapLayersWidget />;
  }
}

ConfigurableUiManager.registerControl(MapLayersWidgetControl.id, MapLayersWidgetControl);
