/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

// the following quiet warning caused by react-beautiful-dnd package
/* eslint-disable @typescript-eslint/unbound-method */

import * as React from "react";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { MapSubLayerProps, MapSubLayerSettings } from "@bentley/imodeljs-common";
import {
  DisplayStyleState, IModelApp, MapLayerSettingsService, MapLayerSource, MapLayerSources, NotifyMessageDetails, OutputMessagePriority,
  ScreenViewport, Viewport,
} from "@bentley/imodeljs-frontend";
import { Toggle } from "@bentley/ui-core";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { BasemapPanel } from "./BasemapPanel";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapLayerOptions, MapTypesOptions, StyleMapLayerSettings } from "../Interfaces";
import { MapLayerSettingsPopupButton } from "./MapLayerSettingsPopupButton";
import "./MapLayerManager.scss";
import { MapLayerDroppable } from "./MapLayerDroppable";

/** @internal */
export interface SourceMapContextProps {
  readonly sources: MapLayerSource[];
  readonly bases: MapLayerSource[];
  readonly refreshFromStyle: () => void;
  readonly activeViewport?: ScreenViewport;
  readonly backgroundLayers?: StyleMapLayerSettings[];
  readonly overlayLayers?: StyleMapLayerSettings[];
  readonly mapTypesOptions?: MapTypesOptions;
}

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({ // eslint-disable-line @typescript-eslint/naming-convention
  sources: [],
  bases: [],
  refreshFromStyle: () => { },
});

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

function getSubLayerProps(subLayerSettings: MapSubLayerSettings[]): MapSubLayerProps[] {
  return subLayerSettings.map((subLayer) => subLayer.toJSON());
}

function getMapLayerSettingsFromStyle(displayStyle: DisplayStyleState | undefined, getBackgroundMap: boolean, populateSubLayers = true): StyleMapLayerSettings[] | undefined {
  if (!displayStyle)
    return undefined;

  const layers = new Array<StyleMapLayerSettings>();

  if (getBackgroundMap) {
    displayStyle.backgroundMapLayers.forEach((layerSettings) => {
      layers.push({
        visible: layerSettings.visible,
        name: layerSettings.name,
        url: layerSettings.url,
        transparency: layerSettings.transparency,
        transparentBackground: layerSettings.transparentBackground,
        subLayers: populateSubLayers ? getSubLayerProps(layerSettings.subLayers) : undefined,
        showSubLayers: false,
        isOverlay: false,
        provider: IModelApp.mapLayerFormatRegistry.createImageryProvider(layerSettings),
      });
    });
  } else {
    displayStyle.overlayMapLayers.forEach((layerSettings) => {
      layers.push({
        visible: layerSettings.visible,
        name: layerSettings.name,
        url: layerSettings.url,
        transparency: layerSettings.transparency,
        transparentBackground: layerSettings.transparentBackground,
        subLayers: populateSubLayers ? getSubLayerProps(layerSettings.subLayers) : undefined,
        showSubLayers: false,
        isOverlay: true,
        provider: IModelApp.mapLayerFormatRegistry.createImageryProvider(layerSettings),
      });
    });
  }

  // since we want to display higher level maps above lower maps in UI reverse their order here.
  return layers.reverse();
}

interface MapLayerManagerProps {
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
  mapLayerOptions?: MapLayerOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerManager(props: MapLayerManagerProps) {
  const [mapSources, setMapSources] = React.useState<MapLayerSource[] | undefined>();
  const [baseSources, setBaseSources] = React.useState<MapLayerSource[] | undefined>();
  const [overlaysLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.OverlayLayers"));
  const [underlaysLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.BackgroundLayers"));
  const { activeViewport, mapLayerOptions } = props;
  const hideExternalMapLayersSection = mapLayerOptions?.hideExternalMapLayers ? mapLayerOptions.hideExternalMapLayers : false;
  const fetchPublicMapLayerSources = mapLayerOptions?.fetchPublicMapLayerSources ? mapLayerOptions.fetchPublicMapLayerSources : false;

  // map layer settings from display style
  const [backgroundMapLayers, setBackgroundMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromStyle(activeViewport?.displayStyle, true));
  const [overlayMapLayers, setOverlayMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromStyle(activeViewport?.displayStyle, false));

  const loadMapLayerSettingsFromStyle = React.useCallback((displayStyle: DisplayStyleState) => {
    setBackgroundMapLayers(getMapLayerSettingsFromStyle(displayStyle, true));
    setOverlayMapLayers(getMapLayerSettingsFromStyle(displayStyle, false));
  }, [setBackgroundMapLayers, setOverlayMapLayers]);

  const [basemapVisible, setBasemapVisible] = React.useState(() => {
    if (activeViewport) {
      return activeViewport.viewFlags.backgroundMap;
    }
    return false;
  });

  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    async function fetchWmsMapData() {
      const sources: MapLayerSource[] = [];
      const bases: MapLayerSource[] = [];
      const sourceLayers = await MapLayerSources.create(undefined, (fetchPublicMapLayerSources && !hideExternalMapLayersSection));
      if (isMounted.current) {
        sourceLayers?.layers.forEach((source: MapLayerSource) => {
          sources.push(source);
        });
        setMapSources(sources); // This is where the list of layers first gets populated.. I need to update it
        // MapUrlDialog gets around knowing MapLayerManager exists and vice versa by affecting the viewports displayStyle which MapLayerManager is listening for
        // We know when displayStyle changes we've added a layer, this layer may not be a custom layer
        //
        sourceLayers?.bases.forEach((source: MapLayerSource) => {
          bases.push(source);
        });
        setBaseSources(bases);
      }
    }
    fetchWmsMapData(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [setMapSources, fetchPublicMapLayerSources, hideExternalMapLayersSection]);

  // runs returned function only when component is unmounted.
  React.useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  React.useEffect(() => {
    const handleNewCustomLayer = async (source: MapLayerSource) => {
      const sources = await MapLayerSources.addSourceToMapLayerSources(source);
      if (!sources) {
        return;
      }
      const newSources: MapLayerSource[] = [];
      sources.layers.forEach((sourceLayer: MapLayerSource) => {
        newSources.push(sourceLayer);
      });
      setMapSources(newSources);
    };
    MapLayerSettingsService.onNewCustomLayerSource.addListener(handleNewCustomLayer);
    return (() => {
      MapLayerSettingsService.onNewCustomLayerSource.removeListener(handleNewCustomLayer);
    });
  }, [setMapSources]);

  // update when a different display style is loaded.
  React.useEffect(() => {
    const handleDisplayStyleChange = (vp: Viewport) => {
      loadMapLayerSettingsFromStyle(vp.displayStyle);
    };
    activeViewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
    return () => {
      activeViewport?.onDisplayStyleChanged.addListener(handleDisplayStyleChange);
    };
  }, [activeViewport, loadMapLayerSettingsFromStyle]);

  const handleOnMenuItemSelection = React.useCallback((action: string, mapLayerSettings: StyleMapLayerSettings) => {
    if (!activeViewport || !activeViewport.displayStyle)
      return;

    const indexInDisplayStyle = activeViewport.displayStyle.findMapLayerIndexByNameAndUrl(mapLayerSettings.name, mapLayerSettings.url, mapLayerSettings.isOverlay);
    if (indexInDisplayStyle < 0)
      return;

    switch (action) {
      case "delete":
        activeViewport.displayStyle.detachMapLayerByIndex(indexInDisplayStyle, mapLayerSettings.isOverlay);
        break;
      case "zoom-to-layer":
        activeViewport.displayStyle.viewMapLayerRange(indexInDisplayStyle, mapLayerSettings.isOverlay, activeViewport).then((status) => {
          if (!status) {
            const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:Messages.NoRangeDefined");
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} [${mapLayerSettings.name}]`));
          }
        }).catch((_error) => { });
        break;
    }
    activeViewport.invalidateRenderPlan();

    // force UI to update
    loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
  }, [activeViewport, loadMapLayerSettingsFromStyle]);

  const handleLayerVisibilityChange = React.useCallback((mapLayerSettings: StyleMapLayerSettings) => {
    if (activeViewport) {
      const isVisible = !mapLayerSettings.visible;

      const displayStyle = activeViewport.displayStyle;
      const indexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndUrl(mapLayerSettings.name, mapLayerSettings.url, mapLayerSettings.isOverlay);
      if (-1 !== indexInDisplayStyle) {
        // update the display style
        displayStyle.changeMapLayerProps({ visible: isVisible }, indexInDisplayStyle, mapLayerSettings.isOverlay);
        activeViewport.invalidateRenderPlan();

        // force UI to update
        loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
      }
    }
  }, [activeViewport, loadMapLayerSettingsFromStyle]);

  const handleMapLayersToggle = React.useCallback(() => {
    if (activeViewport) {
      const newState = !basemapVisible;
      const vf = activeViewport.viewFlags.clone();
      vf.backgroundMap = newState; // Or any other modifications
      activeViewport.viewFlags = vf;
      activeViewport.invalidateRenderPlan();
      setBasemapVisible(newState);
    }
  }, [basemapVisible, activeViewport]);

  const handleOnMapLayerDragEnd = React.useCallback((result: DropResult /* , _provided: ResponderProvided*/) => {
    const { destination, source } = result;

    if (!destination) // dropped outside of list
      return;

    // item was not moved
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    let fromMapLayer: StyleMapLayerSettings | undefined;
    if (source.droppableId === "overlayMapLayers" && overlayMapLayers)
      fromMapLayer = overlayMapLayers[source.index];
    else if (source.droppableId === "backgroundMapLayers" && backgroundMapLayers)
      fromMapLayer = backgroundMapLayers[source.index];

    if (!fromMapLayer || !activeViewport)
      return;

    const displayStyle = activeViewport.displayStyle;
    let toMapLayer: StyleMapLayerSettings | undefined;
    let toIndexInDisplayStyle = -1;

    // If destination.index is undefined then the user dropped the map at the end of list of maps. To get the "actual" index in the style, look up index in style by name.
    // We need to do this because the order of layers in UI are reversed so higher layers appear above lower layers.
    if (undefined !== destination.index) {
      if (destination.droppableId === "overlayMapLayers" && overlayMapLayers)
        toMapLayer = overlayMapLayers[destination.index];
      else if (destination.droppableId === "backgroundMapLayers" && backgroundMapLayers)
        toMapLayer = backgroundMapLayers[destination.index];
      if (toMapLayer)
        toIndexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndUrl(toMapLayer.name, toMapLayer.url, toMapLayer.isOverlay);
    }

    const fromIndexInDisplayStyle = displayStyle.findMapLayerIndexByNameAndUrl(fromMapLayer.name, fromMapLayer.url, fromMapLayer.isOverlay);
    if (fromIndexInDisplayStyle < 0)
      return;

    if (destination.droppableId !== source.droppableId) {
      // see if we moved from "overlayMapLayers" to "backgroundMapLayers" or vice-versa
      const layerProps = activeViewport.displayStyle.mapLayerAtIndex(fromIndexInDisplayStyle, fromMapLayer.isOverlay)?.toJSON();
      if (layerProps) {
        activeViewport.displayStyle.detachMapLayerByIndex(fromIndexInDisplayStyle, fromMapLayer.isOverlay);

        // Manually reverse index when moved from one section to the other
        if (fromMapLayer.isOverlay && backgroundMapLayers) {
          toIndexInDisplayStyle = displayStyle.backgroundMapLayers.length - destination.index;
        } else if (!fromMapLayer.isOverlay && overlayMapLayers) {
          toIndexInDisplayStyle = overlayMapLayers.length - destination.index;
        }

        activeViewport.displayStyle.attachMapLayer(layerProps, !fromMapLayer.isOverlay, toIndexInDisplayStyle);
      }
    } else {
      if (undefined === destination.index) {
        displayStyle.moveMapLayerToBottom(fromIndexInDisplayStyle, destination.droppableId === "overlayMapLayers");
      } else {
        if (toMapLayer) {
          if (toIndexInDisplayStyle !== -1)
            displayStyle.moveMapLayerToIndex(fromIndexInDisplayStyle, toIndexInDisplayStyle, toMapLayer.isOverlay);
        }
      }
    }

    // apply display style change to view
    activeViewport.invalidateRenderPlan();

    // force UI to update
    loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
  }, [loadMapLayerSettingsFromStyle, activeViewport, overlayMapLayers, backgroundMapLayers]);

  const handleRefreshFromStyle = React.useCallback(() => {
    if (activeViewport)
      loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
  }, [activeViewport, loadMapLayerSettingsFromStyle]);

  const [baseMapPanelLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Basemap.BaseMapPanelTitle"));

  return (
    <SourceMapContext.Provider value={{
      activeViewport,
      sources: mapSources ? mapSources : [],
      bases: baseSources ? baseSources : [],
      refreshFromStyle: handleRefreshFromStyle,
      backgroundLayers: backgroundMapLayers,
      overlayLayers: overlayMapLayers,
      mapTypesOptions: mapLayerOptions?.mapTypeOptions,
    }}>
      <div className="map-manager-top-header">
        <span className="map-manager-header-label">{baseMapPanelLabel}</span>
        <div className="map-manager-header-buttons-group">
          <Toggle className="map-manager-toggle" isOn={basemapVisible} onChange={handleMapLayersToggle} />
          <MapLayerSettingsPopupButton />
        </div>
      </div>

      <div className="map-manager-container">

        <div className="map-manager-basemap">
          <BasemapPanel />
        </div>
        {!hideExternalMapLayersSection &&
          <DragDropContext onDragEnd={handleOnMapLayerDragEnd}>
            <div className="map-manager-layer-wrapper">
              <div className="map-manager-underlays" >
                <span className="map-manager-underlays-label">{underlaysLabel}</span><AttachLayerPopupButton isOverlay={false} />
              </div>
              <MapLayerDroppable
                isOverlay={false}
                layersList={backgroundMapLayers}
                getContainerForClone={props.getContainerForClone as any}
                activeViewport={props.activeViewport}
                onMenuItemSelected={handleOnMenuItemSelection}
                onItemVisibilityToggleClicked={handleLayerVisibilityChange} />
            </div>

            <div className="map-manager-layer-wrapper">
              <div className="map-manager-overlays" >
                <span className="map-manager-overlays-label">{overlaysLabel}</span><AttachLayerPopupButton isOverlay={true} />
              </div>
              <MapLayerDroppable
                isOverlay={true}
                layersList={overlayMapLayers}
                getContainerForClone={props.getContainerForClone as any}
                activeViewport={props.activeViewport}
                onMenuItemSelected={handleOnMenuItemSelection}
                onItemVisibilityToggleClicked={handleLayerVisibilityChange} />
            </div>
          </DragDropContext>
        }
      </div >
    </SourceMapContext.Provider >
  );
}

