/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ScreenViewport } from "@itwin/core-frontend";
import { ContextMenu, ContextMenuItem } from "@itwin/core-react";
import { Slider } from "@itwin/itwinui-react";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import "./MapLayerManager.scss";
import { StyleMapLayerSettings } from "../Interfaces";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerSettingsMenu({ mapLayerSettings, onMenuItemSelection, activeViewport }: { mapLayerSettings: StyleMapLayerSettings, onMenuItemSelection: (action: string, mapLayerSettings: StyleMapLayerSettings) => void, activeViewport: ScreenViewport }) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLButtonElement>(null);
  const [labelDetach] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:LayerMenu.Detach"));
  const [labelZoomToLayer] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:LayerMenu.ZoomToLayer"));
  const [hasRangeData, setHasRangeData] = React.useState<boolean | undefined>();
  const [transparency, setTransparency] = React.useState(mapLayerSettings.transparency);

  React.useEffect(() => {
    async function fetchRangeData() {
      let hasRange = false;
      const indexInDisplayStyle = activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(mapLayerSettings.name, mapLayerSettings.url, mapLayerSettings.isOverlay);
      if (undefined !== indexInDisplayStyle) {
        hasRange = (undefined !== await activeViewport.displayStyle.getMapLayerRange(indexInDisplayStyle, mapLayerSettings.isOverlay));
      }
      setHasRangeData(hasRange);
    }
    fetchRangeData(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeViewport, mapLayerSettings]);

  const onSettingsClick = React.useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, [setIsSettingsOpen]);

  const handleCloseSetting = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  const handleRemoveLayer = React.useCallback(() => {
    setIsSettingsOpen(false);
    onMenuItemSelection("delete", mapLayerSettings);
  }, [setIsSettingsOpen, onMenuItemSelection, mapLayerSettings]);

  const handleZoomToLayer = React.useCallback(() => {
    setIsSettingsOpen(false);
    onMenuItemSelection("zoom-to-layer", mapLayerSettings);
  }, [setIsSettingsOpen, onMenuItemSelection, mapLayerSettings]);

  const applyTransparencyChange = React.useCallback((value: number) => {
    if (activeViewport) {
      const newTransparency = value;
      const displayStyle = activeViewport.displayStyle;
      const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndUrl(mapLayerSettings.name, mapLayerSettings.url, mapLayerSettings.isOverlay);
      if (-1 !== indexInDisplayStyle) {
        const styleTransparency = displayStyle.mapLayerAtIndex(indexInDisplayStyle, mapLayerSettings.isOverlay)?.transparency;
        const styleTransparencyValue = styleTransparency ? styleTransparency : 0;
        if (Math.abs(styleTransparencyValue - newTransparency) > 0.01) {
          // update the display style
          displayStyle.changeMapLayerProps({ transparency: newTransparency }, indexInDisplayStyle, mapLayerSettings.isOverlay);
          activeViewport.invalidateRenderPlan();

          // force UI to update
          // loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
        }
      }
    }
  }, [activeViewport, mapLayerSettings]);

  const handleTransparencyChange = React.useCallback((values: readonly number[]) => {
    if (values.length) {
      const newTransparency = values[0] / 100.0;
      if (newTransparency !== transparency) {
        setTransparency(newTransparency);
        applyTransparencyChange(newTransparency);
      }
    }
  }, [transparency, applyTransparencyChange]);

  return (
    <>
      <button data-testid="map-layer-settings" className="map-layer-settings icon icon-more-vertical-2" ref={settingsRef} onClick={onSettingsClick} ></button>
      <ContextMenu opened={isSettingsOpen && (undefined !== hasRangeData)} onOutsideClick={handleCloseSetting} >
        <ContextMenuItem hideIconContainer={true} key={0} className={hasRangeData ? "" : "core-context-menu-disabled"} onSelect={handleZoomToLayer}>{labelZoomToLayer}</ContextMenuItem>
        <ContextMenuItem hideIconContainer={true} key={1} onSelect={handleRemoveLayer}>{labelDetach}</ContextMenuItem>
        <ContextMenuItem hideIconContainer={true} key={2} >
          <Slider min={0} max={100} values={[transparency * 100]} step={1} onChange={handleTransparencyChange} />
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
}
