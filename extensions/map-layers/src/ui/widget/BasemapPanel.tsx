/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
// cSpell:ignore droppable Sublayer Basemap

import { ModalDialogManager } from "@itwin/appui-react";
import { BaseMapLayerSettings, ColorByName, ColorDef, ImageMapLayerSettings, MapLayerProps } from "@itwin/core-common";
import { DisplayStyleState } from "@itwin/core-frontend";
import { WebFontIcon } from "@itwin/core-react";
import { ColorPickerDialog, ColorSwatch } from "@itwin/imodel-components-react";
import { Button, Select, SelectOption } from "@itwin/itwinui-react";
import * as React from "react";
import { MapLayersUI } from "../../mapLayers";
import "./BasemapPanel.scss";
import { useSourceMapContext } from "./MapLayerManager";
import { TransparencyPopupButton } from "./TransparencyPopupButton";

function getBaseMapFromStyle(displayStyle: DisplayStyleState | undefined) {
  if (!displayStyle)
    return undefined;

  if (displayStyle.settings.mapImagery.backgroundBase instanceof ImageMapLayerSettings || displayStyle.settings.mapImagery.backgroundBase instanceof ColorDef)
    return displayStyle.settings.mapImagery.backgroundBase.toJSON();

  return undefined;
}

interface BasemapPanelProps {
  disabled?: boolean;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function BasemapPanel(props: BasemapPanelProps) {
  const [useColorLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.ColorFill"));
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

  const baseMapOptions = React.useMemo<SelectOption<string>[]>(() => {
    const baseOptions: SelectOption<string>[] = [];

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
  const [colorDialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:ColorDialog.Title"));
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
    ModalDialogManager.openDialog(<ColorPickerDialog dialogTitle={colorDialogTitle} color={newColor} colorPresets={presetColors} colorInputType={"rgb"}
      onOkResult={handleBackgroundColorDialogOk} onCancelResult={handleBackgroundColorDialogCancel} />);
  }, [presetColors, handleBackgroundColorDialogOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBaseMapSelection = React.useCallback((value: string) => {
    if (bases && activeViewport && value) {
      const baseMap = bases.find((map) => map.name === value);
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
    if (activeViewport && activeViewport.displayStyle.backgroundMapBase instanceof ImageMapLayerSettings) {
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

  const [baseLayerLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.BaseLayer"));
  const [selectBaseMapLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Basemap.SelectBaseMap"));
  const [toggleVisibility] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.ToggleVisibility"));

  return (
    <>
      <div className="map-manager-base-item" >
        <Button size="small" styleType="borderless"  title={toggleVisibility} onClick={handleVisibilityChange} disabled={props.disabled}>
          <WebFontIcon iconName={baseMapVisible ? "icon-visibility" : "icon-visibility-hide-2"} />
        </Button>
        <span className="map-manager-base-label">{baseLayerLabel}</span>
        <Select className="map-manager-base-item-select"
          options={baseMapOptions}
          placeholder={selectBaseMapLabel}
          value={selectedBaseMapValue.value}
          onChange={handleBaseMapSelection} size="small"
          disabled={props.disabled}
        />
        {
          baseIsColor &&
          <ColorSwatch className="map-manager-base-item-color" colorDef={ColorDef.fromJSON(bgColor)} round={false} onColorPick={handleBgColorClick} />
        }
        <TransparencyPopupButton disabled={props.disabled} transparency={baseMapTransparencyValue} onTransparencyChange={handleBasemapTransparencyChange}/>
      </div>
    </>
  );
}
