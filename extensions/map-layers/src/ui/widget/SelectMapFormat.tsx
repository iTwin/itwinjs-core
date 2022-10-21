/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { IconButton, MenuItem, Select, SelectOption } from "@itwin/itwinui-react";
import * as React from "react";
import { MapTypesOptions } from "../Interfaces";
import "./MapUrlDialog.scss";
import {SvgTechnicalPreviewMini} from "@itwin/itwinui-icons-color-react";
import { MapLayersUI } from "../../mapLayers";

// TODO:
// Remove this structure and iterate over the registry's active formats.
// Still need a proper way to exclude some format, like we currently do with
// 'TileUrl' without the need to hardcode any format Id.
export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
  arcGisFeature: "ArcGISFeature",
};

interface SelectMapFormatProps {
  value?: string;
  disabled?: boolean;
  mapTypesOptions?: MapTypesOptions;
  onChange?: (mapType: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SelectMapFormat(props: SelectMapFormatProps) {

  const [mapFormat, setMapFormat] = React.useState(props.value ?? MAP_TYPES.arcGis);
  const [techPreviewTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.TechPreviewBadgeTooltip"));

  const [mapFormats] = React.useState((): SelectOption<string>[] => {
    const formats = [
      { value: MAP_TYPES.arcGis,        label: MAP_TYPES.arcGis },
      { value: MAP_TYPES.arcGisFeature, label: MAP_TYPES.arcGisFeature, id:"techPreview" },
      { value: MAP_TYPES.wms,           label: MAP_TYPES.wms },
      { value: MAP_TYPES.wmts,          label: MAP_TYPES.wmts },
    ];
    if (props.mapTypesOptions?.supportTileUrl)
      formats.push({ value: MAP_TYPES.tileUrl, label: MAP_TYPES.tileUrl });
    return formats;
  });

  const handleOnChange = React.useCallback((value: string) => {
    setMapFormat(value);
    if (props.onChange) {
      props.onChange(value);
    }
  }, [props]);

  return (

    <Select
      className="map-layer-source-select"
      options={mapFormats}
      value={mapFormat}
      disabled={props.disabled}
      onChange={handleOnChange}
      size="small"
      itemRenderer={
        (option) => (
          <MenuItem
            badge={ option.id?.includes("techPreview") ?
              <div title={techPreviewTooltip}>
                <IconButton className="map-layer-source-select-previewBadge"  size="small"><SvgTechnicalPreviewMini /></IconButton>
              </div> : undefined}
          >{option.label}</MenuItem>) }
    />
  );
}
