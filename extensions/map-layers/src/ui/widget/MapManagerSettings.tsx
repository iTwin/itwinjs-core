/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import * as React from "react";
import { NumberInput } from "@itwin/core-react";
import type { ViewState3d } from "@itwin/core-frontend";
import {  QuantityType } from "@itwin/core-frontend";
import type { BackgroundMapProps, BackgroundMapSettings, TerrainProps } from "@itwin/core-common";
import { PlanarClipMaskMode, PlanarClipMaskPriority, TerrainHeightOriginMode } from "@itwin/core-common";
import { useSourceMapContext } from "./MapLayerManager";
import "./MapManagerSettings.scss";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import type { SelectOption} from "@itwin/itwinui-react";
import { Select, Slider, ToggleSwitch } from "@itwin/itwinui-react";
import { QuantityNumberInput } from "@itwin/imodel-components-react";

/* eslint-disable deprecation/deprecation */

enum MapMaskingOption {
  None,
  AllModels
}

function getMapMaskingFromBackgroundMapSetting(backgroundMapSettings: BackgroundMapSettings): MapMaskingOption {
  if (backgroundMapSettings.planarClipMask.mode === PlanarClipMaskMode.Priority && backgroundMapSettings.planarClipMask.priority) {
    if (backgroundMapSettings.planarClipMask.priority >= PlanarClipMaskPriority.BackgroundMap) {
      return MapMaskingOption.AllModels;
    }

  }
  return MapMaskingOption.None;
}

function getHeightOriginModeKey(mode: TerrainHeightOriginMode): string {
  if (TerrainHeightOriginMode.Geodetic === mode)
    return "geodetic";
  if (TerrainHeightOriginMode.Geoid === mode)
    return "geoid";
  return "ground";
}

function getHeightOriginModeFromKey(mode: string): TerrainHeightOriginMode {
  if ("geodetic" === mode)
    return TerrainHeightOriginMode.Geodetic;
  if ("geoid" === mode)
    return TerrainHeightOriginMode.Geoid;
  return TerrainHeightOriginMode.Ground;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapManagerSettings() {
  const { activeViewport } = useSourceMapContext();
  const backgroundMapSettings = (activeViewport!.view as ViewState3d).getDisplayStyle3d().settings.backgroundMap;

  const [transparency, setTransparency] = React.useState(() =>
    typeof backgroundMapSettings.transparency === "boolean"
      ? 0
      : Math.round((backgroundMapSettings.transparency) * 100) / 100);

  const terrainSettings = backgroundMapSettings.terrainSettings;
  const [groundBias, setGroundBias] = React.useState(() => backgroundMapSettings.groundBias);

  const terrainHeightOptions = React.useRef<SelectOption<string>[]>([
    { value: "geodetic", label: MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGeodetic") },
    { value: "geoid", label: MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGeoid") },
    { value: "ground", label: MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGround") },
  ]);

  const updateTerrainSettings = React.useCallback((props: TerrainProps) => {
    activeViewport!.changeBackgroundMapProps({ terrainSettings: props });
    activeViewport!.invalidateRenderPlan();
  }, [activeViewport]);

  const updateBackgroundMap = React.useCallback((props: BackgroundMapProps) => {
    activeViewport!.changeBackgroundMapProps(props);
    activeViewport!.invalidateRenderPlan();
  }, [activeViewport]);

  const [heightOriginMode, setHeightOriginMode] = React.useState(() => getHeightOriginModeKey(terrainSettings.heightOriginMode));
  const handleElevationTypeSelected = React.useCallback((newValue: string): void => {
    if (newValue) {
      const newHeightOriginMode = getHeightOriginModeFromKey(newValue);
      updateTerrainSettings({ heightOriginMode: newHeightOriginMode });
      setHeightOriginMode(newValue);
    }
  }, [updateTerrainSettings]);

  const [maskTransparency, setMaskTransparency] = React.useState(() =>
    backgroundMapSettings.planarClipMask.transparency === undefined
      ? undefined
      : Math.round((backgroundMapSettings.planarClipMask.transparency) * 100) / 100);

  const getNormalizedMaskTransparency = React.useCallback(() => { return (maskTransparency === undefined ? 0 : maskTransparency); }, [maskTransparency]);

  const updateMaskingSettings = React.useCallback((option: MapMaskingOption) => {
    if (option === MapMaskingOption.AllModels) {
      activeViewport!.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: maskTransparency } });
    }
    if (option === MapMaskingOption.None) {
      activeViewport!.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } });
    }

    activeViewport!.invalidateRenderPlan();
  }, [activeViewport, maskTransparency]);

  const [masking, setMasking] = React.useState(() => getMapMaskingFromBackgroundMapSetting(backgroundMapSettings));

  const onMaskingToggle = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const maskingOption = checked ? MapMaskingOption.AllModels : MapMaskingOption.None;
    updateMaskingSettings(maskingOption);
    setMasking(maskingOption);
  }, [updateMaskingSettings]);

  const [overrideMaskTransparency, setOverrideMaskTransparency] = React.useState(() => backgroundMapSettings.planarClipMask.transparency !== undefined);

  const onOverrideMaskTransparencyToggle = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const trans = checked ? getNormalizedMaskTransparency() : undefined;
    activeViewport!.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: trans } });

    setOverrideMaskTransparency(checked);
  }, [activeViewport, getNormalizedMaskTransparency]);

  const handleElevationChange = React.useCallback((value: number) => {
    if (value !== undefined) {
      updateBackgroundMap({ groundBias: value });
      setGroundBias(value);
    }
  }, [updateBackgroundMap]);

  const handleAlphaChange = React.useCallback((values: readonly number[]) => {
    const newTransparency = values[0] / 100;
    activeViewport!.changeBackgroundMapProps({ transparency: newTransparency });
    activeViewport!.invalidateRenderPlan();
    setTransparency(newTransparency);
  }, [activeViewport]);

  const handleMaskTransparencyChange = React.useCallback((values: readonly number[]) => {
    const newTransparency = values[0] / 100;
    activeViewport!.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: newTransparency } });
    activeViewport!.invalidateRenderPlan();
    setMaskTransparency(newTransparency);
  }, [activeViewport]);

  const [applyTerrain, setApplyTerrain] = React.useState(() => backgroundMapSettings.applyTerrain);

  const onToggleTerrain = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    updateBackgroundMap({ applyTerrain: checked });
    setApplyTerrain(checked);
  }, [updateBackgroundMap]);

  const [exaggeration, setExaggeration] = React.useState(() => terrainSettings.exaggeration);

  const handleExaggerationChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    if (undefined !== value) {
      updateTerrainSettings({ exaggeration: value });
      setExaggeration(value);
    }
  }, [updateTerrainSettings]);

  const [terrainOrigin, setTerrainOrigin] = React.useState(() => terrainSettings.heightOrigin);

  const handleHeightOriginChange = React.useCallback((value: number) => {
    if (undefined !== value) {
      updateTerrainSettings({ heightOrigin: value });
      setTerrainOrigin(value);
    }
  }, [updateTerrainSettings]);

  const [useDepthBuffer, setUseDepthBuffer] = React.useState(() => backgroundMapSettings.useDepthBuffer);
  const onToggleUseDepthBuffer = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    updateBackgroundMap({ useDepthBuffer: checked });
    setUseDepthBuffer(checked);
  }, [updateBackgroundMap]);

  /** Disable commas and letters */
  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 188 || (event.keyCode >= 65 && event.keyCode <= 90))
      event.preventDefault();
  }, []);

  const [isLocatable, setIsLocatable] = React.useState(() => backgroundMapSettings.locatable);
  const onLocatableToggle = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    updateBackgroundMap({ nonLocatable: !checked });
    setIsLocatable(checked);
  }, [updateBackgroundMap]);

  const [transparencyLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Transparency"));
  const [terrainLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Terrain"));
  const [enableLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Enable"));
  const [elevationOffsetLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.ElevationOffset"));
  const [useDepthBufferLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.UseDepthBuffer"));
  const [modelHeightLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.ModelHeight"));
  const [heightOriginLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.HeightOrigin"));
  const [exaggerationLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Exaggeration"));
  const [locatableLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Locatable"));
  const [maskingLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.Mask"));
  const [overrideMaskTransparencyLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.OverrideMaskTransparency"));
  const [maskTransparencyLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Settings.MaskTransparency"));

  return (
    <>
      <div className="maplayers-settings-container">

        <span className="map-manager-settings-label">{transparencyLabel}</span>
        <Slider min={0} max={100} values={[transparency * 100]} onChange={handleAlphaChange} step={1} />

        <span className="map-manager-settings-label">{locatableLabel}</span>
        {/* eslint-disable-next-line deprecation/deprecation */}
        <ToggleSwitch onChange={onLocatableToggle} checked={isLocatable} />

        <span className="map-manager-settings-label">{maskingLabel}</span>
        {/* eslint-disable-next-line deprecation/deprecation */}
        <ToggleSwitch onChange={onMaskingToggle} checked={masking !== MapMaskingOption.None} />

        <span className="map-manager-settings-label">{overrideMaskTransparencyLabel}</span>
        <ToggleSwitch disabled={masking === MapMaskingOption.None} onChange={onOverrideMaskTransparencyToggle} checked={overrideMaskTransparency} />

        <span className="map-manager-settings-label">{maskTransparencyLabel}</span>
        <Slider disabled={masking === MapMaskingOption.None || !overrideMaskTransparency} min={0} max={100} values={[getNormalizedMaskTransparency() * 100]} onChange={handleMaskTransparencyChange} step={1} />

        <>
          <span className="map-manager-settings-label">{elevationOffsetLabel}</span>
          <QuantityNumberInput disabled={applyTerrain} persistenceValue={groundBias} step={1} snap quantityType={QuantityType.LengthEngineering} onChange={handleElevationChange} onKeyDown={onKeyDown}/>

          <span className="map-manager-settings-label">{useDepthBufferLabel}</span>
          {/* eslint-disable-next-line deprecation/deprecation */}
          <ToggleSwitch disabled={applyTerrain} onChange={onToggleUseDepthBuffer} checked={useDepthBuffer} />
        </>

      </div>
      <div className="map-manager-settings-terrain-container">
        <fieldset>
          <legend>{terrainLabel}</legend>

          <div className="maplayers-settings-container">

            <span className="map-manager-settings-label">{enableLabel}</span>
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ToggleSwitch onChange={onToggleTerrain} checked={applyTerrain} />

            <span className="map-manager-settings-label">{modelHeightLabel}</span>
            <QuantityNumberInput disabled={!applyTerrain} persistenceValue={terrainOrigin} snap quantityType={QuantityType.LengthEngineering} onChange={handleHeightOriginChange} onKeyDown={onKeyDown}/>

            <span className="map-manager-settings-label">{heightOriginLabel}</span>
            <Select options={terrainHeightOptions.current} disabled={!applyTerrain} value={heightOriginMode} onChange={handleElevationTypeSelected} size="small" />

            <span className="map-manager-settings-label">{exaggerationLabel}</span>
            <NumberInput value={exaggeration} disabled={!applyTerrain} onChange={handleExaggerationChange} onKeyDown={onKeyDown} />
          </div>

        </fieldset>
      </div>
    </>
  );
}
