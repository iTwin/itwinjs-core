/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
// cSpell:ignore droppable Sublayer Basemap

import * as React from "react";
import { BaseMapLayerSettings, ColorByName, ColorDef, MapLayerProps, MapLayerSettings } from "@itwin/core-common";
import { DisplayStyleState } from "@itwin/core-frontend";
import { ColorPickerDialog, ColorSwatch } from "@itwin/imodel-components-react";
import { OptionType, ThemedSelect, WebFontIcon } from "@itwin/core-react";
import { ActionMeta, ValueType } from "react-select/src/types";
import { ModalDialogManager } from "@itwin/appui-react";
import { TransparencyPopupButton } from "./TransparencyPopupButton";
import { useSourceMapContext } from "./MapLayerManager";
import "./BasemapPanel.scss";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";

function getBaseMapFromStyle(displayStyle: DisplayStyleState | undefined) {
  if (!displayStyle)
    return undefined;

  if (displayStyle.settings.mapImagery.backgroundBase instanceof MapLayerSettings || displayStyle.settings.mapImagery.backgroundBase instanceof ColorDef)
    return displayStyle.settings.mapImagery.backgroundBase.toJSON();

  return undefined;
}

interface BaseOption extends OptionType {
  color?: string;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function BasemapPanel() {
  const [useColorLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Basemap.ColorFill"));
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

  const baseMapOptions = React.useMemo<BaseOption[]>(() => {
    const baseOptions: BaseOption[] = [];

    baseOptions.push({ value: useColorLabel, label: useColorLabel });

    if (bases)
      baseOptions.push(...bases.map((value) => ({ value: value.name, label: value.name })));
    return baseOptions;
  }, [bases, useColorLabel]);

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

  const [selectedBaseMap, setSelectedBaseMap] = React.useState<MapLayerProps | number | undefined>(getBaseMapFromStyle(activeViewport?.displayStyle));
  const baseIsColor = React.useMemo(() => typeof selectedBaseMap === "number", [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && (selectedBaseMap !== undefined), [baseIsColor, selectedBaseMap]);
  const bgColor = React.useMemo(() => baseIsColor ? selectedBaseMap as number : presetColors[0].toJSON(), [baseIsColor, selectedBaseMap, presetColors]);
  const [colorDialogTitle] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:ColorDialog.Title"));
  const selectedBaseMapValue = React.useMemo(() => {
    if (baseIsMap) {
      const mapName = (selectedBaseMap! as MapLayerProps).name;
      const foundItem = baseMapOptions.find((value) => value.label === mapName);
      if (foundItem)
        return foundItem;
    }
    return baseMapOptions[0];
  }, [selectedBaseMap, baseMapOptions, baseIsMap]);

  const handleBackgroundColorDialogOk = React.useCallback((bgColorDef: ColorDef) => {
    ModalDialogManager.closeDialog();
    if (activeViewport) {
      // change color and make sure previously set transparency is not lost.
      const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
      activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
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
      const baseMap = bases.find((map) => map.name === (value as BaseOption).label);
      if (baseMap) {
        const baseProps: MapLayerProps = baseMap.toJSON();
        if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
          activeViewport.displayStyle.backgroundMapBase = activeViewport.displayStyle.backgroundMapBase.clone(baseProps);
        } else {
          activeViewport.displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON(baseProps);
        }
        activeViewport.invalidateRenderPlan();
        setSelectedBaseMap(baseProps);
      } else {
        const bgColorDef = ColorDef.fromJSON(bgColor);
        const curTransparency = activeViewport.displayStyle.backgroundMapBase instanceof ColorDef ? activeViewport.displayStyle.backgroundMapBase.getTransparency() : 0;
        activeViewport.displayStyle.backgroundMapBase = bgColorDef.withTransparency(curTransparency);
        activeViewport.invalidateRenderPlan();
        setSelectedBaseMap(bgColorDef.toJSON());
      }
    }
  }, [bases, activeViewport, bgColor]);

  const [baseMapVisible, setBaseMapVisible] = React.useState(() => {
    if (activeViewport && activeViewport.displayStyle.backgroundMapBase instanceof MapLayerSettings) {
      return activeViewport.displayStyle.backgroundMapBase.visible;
    }
    return false;
  });

  const handleVisibilityChange = React.useCallback(() => {
    if (activeViewport) {
      const newState = !baseMapVisible;
      // BaseMap visibility is only support when backgroundBase is an instance of BaseMapLayerSettings (i.e not a color)...
      if (activeViewport.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings) {
        activeViewport.displayStyle.backgroundMapBase = activeViewport.displayStyle.backgroundMapBase.clone({ visible: newState });
        activeViewport.invalidateRenderPlan();
      }
      setBaseMapVisible(newState);
    }
  }, [baseMapVisible, activeViewport]);

  const [baseLayerLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Basemap.BaseLayer"));
  const [selectBaseMapLabel] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Basemap.SelectBaseMap"));
  const [toggleVisibility] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));

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
