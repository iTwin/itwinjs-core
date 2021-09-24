/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import * as React from "react";
import { BackgroundMapProvider, BackgroundMapProviderProps, BackgroundMapType, BaseLayerProps, ColorByName, ColorDef, MapLayerProps, MapLayerSettings } from "@bentley/imodeljs-common";
import { DisplayStyleState } from "@bentley/imodeljs-frontend";
import { ColorPickerDialog, ColorSwatch } from "@bentley/ui-imodel-components";
import { OptionType, ThemedSelect, WebFontIcon } from "@bentley/ui-core";
import { ActionMeta, ValueType } from "react-select/src/types";
import { ModalDialogManager } from "@bentley/ui-framework";
import { TransparencyPopupButton } from "./TransparencyPopupButton";
import { useSourceMapContext } from "./MapLayerManager";
import "./BasemapPanel.scss";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";

function getBaseMapFromStyle(displayStyle: DisplayStyleState | undefined) {
  if (!displayStyle)
    return undefined;

  return displayStyle.settings.mapImagery.backgroundBase.toJSON();
}

interface BaseOption extends OptionType {
  color?: string;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function BasemapPanel() {
  const [useColorLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Basemap.ColorFill"));
  const { activeViewport, bases } = useSourceMapContext();

  const [baseMapTransparencyValue, setBaseMapTransparencyValue] = React.useState(() => {
    if (activeViewport)
      return activeViewport.displayStyle.baseMapTransparency;
    return 0;
  });

  const handleBasemapTransparencyChange = React.useCallback((transparency: number) => {
    if (activeViewport) {
      activeViewport.displayStyle.changeBaseMapTransparency(transparency);
      activeViewport.invalidateRenderPlan();
      setBaseMapTransparencyValue(transparency);
    }
  }, [activeViewport]);

  const [presetBackgroundMapProviders] = React.useState([
    BackgroundMapProvider.fromJSON({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street }}),
    BackgroundMapProvider.fromJSON({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Aerial }}),
    BackgroundMapProvider.fromJSON({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid }}),
  ]);

  const baseMapOptions = React.useMemo<BaseOption[]>(() => {
    const baseOptions: BaseOption[] = [];

    for (const bgMapProvider of presetBackgroundMapProviders) {
      const label = bgMapProvider.label();
      baseOptions.push({ value: label, label });
    }

    baseOptions.push({ value: useColorLabel, label: useColorLabel });

    if (bases)
      baseOptions.push(...bases.map((value) => ({ value: value.name, label: value.name })));
    return baseOptions;
  }, [bases, presetBackgroundMapProviders, useColorLabel]);

  const [presetColors] = React.useState([
    ColorDef.create(ColorByName.grey),
    ColorDef.create(ColorByName.lightGrey),
    ColorDef.create(ColorByName.darkGrey),
    ColorDef.create(ColorByName.lightBlue),
    ColorDef.create(ColorByName.lightGreen),
    ColorDef.create(ColorByName.darkGreen),
    ColorDef.create(ColorByName.tan),
    ColorDef.create(ColorByName.darkBrown),
  ]);

  const [selectedBaseMap, setSelectedBaseMap] = React.useState<BaseLayerProps | undefined>(getBaseMapFromStyle(activeViewport?.displayStyle));
  const baseIsColor = React.useMemo(() => typeof selectedBaseMap === "number", [selectedBaseMap]);
  const baseIsBackgroundMapProvider = React.useMemo(() => BackgroundMapProvider.isMatchingProps(selectedBaseMap), [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && !baseIsBackgroundMapProvider && (selectedBaseMap !== undefined), [baseIsColor, selectedBaseMap]);
  const bgColor = React.useMemo(() => baseIsColor ? selectedBaseMap as number : presetColors[0].toJSON(), [baseIsColor, selectedBaseMap, presetColors]);
  const [colorDialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:ColorDialog.Title"));
  const selectedBaseMapValue = React.useMemo(() => {
    if (baseIsMap) {
      const mapName = (selectedBaseMap as MapLayerProps).name!;
      const foundItem = baseMapOptions.find((value) => value.label === mapName);
      if (foundItem)
        return foundItem;
    } else if (baseIsBackgroundMapProvider) {
      if (selectedBaseMap) {
        const provider = BackgroundMapProvider.fromJSON(selectedBaseMap as BackgroundMapProviderProps);
        const providerLabel = provider?.label();
        const foundItem = baseMapOptions.find((value) => value.label === providerLabel);
        if (foundItem)
          return foundItem;
      }

    }
    return baseMapOptions[0];  // default to color
  }, [selectedBaseMap, baseMapOptions, baseIsMap, baseIsBackgroundMapProvider]);

  const handleBackgroundColorDialogOk = React.useCallback((bgColorDef: ColorDef) => {
    ModalDialogManager.closeDialog();
    if (activeViewport) {
      activeViewport.displayStyle.changeBaseMapProps(bgColorDef);
      activeViewport.invalidateRenderPlan();
      setSelectedBaseMap(bgColorDef.toJSON());
    }
  }, [activeViewport]);

  const handleBackgroundColorDialogCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const handleBgColorClick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    ModalDialogManager.openDialog(<ColorPickerDialog dialogTitle={colorDialogTitle} color={newColor} colorPresets={presetColors}
      onOkResult={handleBackgroundColorDialogOk} onCancelResult={handleBackgroundColorDialogCancel} />);
  }, [presetColors, handleBackgroundColorDialogOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBaseMapSelection = React.useCallback((value: ValueType<BaseOption>, action: ActionMeta<BaseOption>) => {
    if (bases && activeViewport && action.action === "select-option" && value) {
      const presetBgMap = presetBackgroundMapProviders.find((bg) => bg.label() === (value as BaseOption).label);

      if (presetBgMap) {
        const bgMapsProps = presetBgMap.toJSON();
        // visible/transparency are set to undefined to preserve previously set values
        bgMapsProps.providerData = {...bgMapsProps.providerData, visible: undefined, transparency: undefined};
        activeViewport.displayStyle.changeBaseMapProps(bgMapsProps);
        activeViewport.invalidateRenderPlan();
        setSelectedBaseMap(bgMapsProps);
      } else {
        const baseMap = bases.find((map) => map.name === (value as BaseOption).label);
        if (baseMap) {
          const baseProps = baseMap.toJSON();
          activeViewport.displayStyle.changeBaseMapProps(baseProps);
          activeViewport.invalidateRenderPlan();
          setSelectedBaseMap(baseProps);
        } else {
          const bgColorDef = ColorDef.fromJSON(bgColor);
          activeViewport.displayStyle.changeBaseMapProps(bgColorDef);
          activeViewport.invalidateRenderPlan();
          setSelectedBaseMap(bgColorDef.toJSON());
        }
      }

    }
  }, [bases, activeViewport, presetBackgroundMapProviders, bgColor]);

  const [baseMapVisible, setBaseMapVisible] = React.useState(() => {
    if (activeViewport &&
      (activeViewport.displayStyle.backgroundMapBase instanceof MapLayerSettings || activeViewport.displayStyle.backgroundMapBase instanceof BackgroundMapProvider)) {
      return activeViewport.displayStyle.backgroundMapBase.visible;
    }
    return false;
  });

  const handleVisibilityChange = React.useCallback(() => {
    if (activeViewport) {
      const newState = !baseMapVisible;
      activeViewport.displayStyle.changeBaseMapVisible(newState);
      activeViewport.invalidateRenderPlan();
      setBaseMapVisible(newState);
    }
  }, [baseMapVisible, activeViewport]);

  const [baseLayerLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Basemap.BaseLayer"));
  const [selectBaseMapLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Basemap.SelectBaseMap"));
  const [toggleVisibility] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.ToggleVisibility"));

  return (
    <>
      <div className="map-manager-base-item" >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={handleVisibilityChange}>
          <WebFontIcon iconName={baseMapVisible ? "icon-visibility" : "icon-visibility-hide-2"} />
        </button>
        <span className="map-manager-base-label">{baseLayerLabel}</span>
        <ThemedSelect options={baseMapOptions} closeMenuOnSelect placeholder={selectBaseMapLabel} value={selectedBaseMapValue} onChange={handleBaseMapSelection} />
        {
          baseIsColor &&
          <ColorSwatch className="map-manager-base-item-color" colorDef={ColorDef.fromJSON(bgColor)} round={false} onColorPick={handleBgColorClick} />
        }
        <TransparencyPopupButton transparency={baseMapTransparencyValue} onTransparencyChange={handleBasemapTransparencyChange} />
      </div>
    </>
  );
}
