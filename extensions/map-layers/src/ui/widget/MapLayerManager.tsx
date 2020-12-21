/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

// the following quiet warning caused by react-beautiful-dnd package
/* eslint-disable @typescript-eslint/unbound-method */

import * as React from "react";
import { DragDropContext, Draggable, DraggableChildrenFn, Droppable, DropResult } from "react-beautiful-dnd";
import { MapSubLayerProps, MapSubLayerSettings } from "@bentley/imodeljs-common";
import {
  DisplayStyleState, IModelApp, MapLayerImageryProvider, MapLayerSettingsService, MapLayerSource, MapLayerSources, NotifyMessageDetails, OutputMessagePriority,
  ScreenViewport, Viewport,
} from "@bentley/imodeljs-frontend";
import { ContextMenu, ContextMenuItem, Icon, Slider } from "@bentley/ui-core";
import { assert } from "@bentley/bentleyjs-core";
import { SubLayersPopupButton } from "./SubLayersPopupButton";
import { AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { BasemapPanel } from "./BasemapPanel";
import { MapSettingsPanel } from "./MapSettingsPanel";
import { MapLayerOptions, MapLayersUiItemsProvider, MapTypesOptions } from "../MapLayersUiItemsProvider";
import "./MapLayerManager.scss";

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

export interface StyleMapLayerSettings {
  /** Name */
  name: string;
  /** URL */
  url: string;
  /** Controls visibility of layer */
  visible: boolean;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency: number;
  /** Transparent background */
  transparentBackground: boolean;
  /** set map as underlay or overlay */
  isOverlay: boolean;
  /** Available map sub-layer */
  subLayers?: MapSubLayerProps[];
  /** sub-layer panel displayed. */
  showSubLayers: boolean;
  /** Some format can publish only a single layer at a time (i.e WMTS) */
  provider?: MapLayerImageryProvider;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function MapLayerSettingsMenu({ mapLayerSettings, onMenuItemSelection, activeViewport }: { mapLayerSettings: StyleMapLayerSettings, onMenuItemSelection: (action: string, mapLayerSettings: StyleMapLayerSettings) => void, activeViewport: ScreenViewport }) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLButtonElement>(null);
  const [labelDetach] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:LayerMenu.Detach"));
  const [labelZoomToLayer] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:LayerMenu.ZoomToLayer"));
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
        <ContextMenuItem key={0} className={hasRangeData ? "" : "core-context-menu-disabled"} onSelect={handleZoomToLayer}>{labelZoomToLayer}</ContextMenuItem>
        <ContextMenuItem key={1} onSelect={handleRemoveLayer}>{labelDetach}</ContextMenuItem>
        <ContextMenuItem key={2} >
          <Slider min={0} max={100} values={[transparency * 100]} step={1} showTooltip showMinMax onChange={handleTransparencyChange} />
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
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
  const [noBackgroundMapsSpecifiedLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.NoBackgroundLayers"));
  const [noUnderlaysSpecifiedLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.NoOverlayLayers"));
  const [toggleVisibility] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.ToggleVisibility"));
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

  const handleVisibilityChange = React.useCallback((mapLayerSettings: StyleMapLayerSettings) => {
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

  const renderOverlayItem: DraggableChildrenFn = (overlayDragProvided, _, rubric) => {
    assert(overlayMapLayers !== undefined);

    return (
      <div className="map-manager-source-item" data-id={rubric.source.index} key={overlayMapLayers[rubric.source.index].name}
        {...overlayDragProvided.draggableProps}
        ref={overlayDragProvided.innerRef} >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={() => { handleVisibilityChange(overlayMapLayers[rubric.source.index]); }}>
          <Icon iconSpec={overlayMapLayers[rubric.source.index].visible ? "icon-visibility" : "icon-visibility-hide-2"} /></button>
        <span className="map-manager-item-label" {...overlayDragProvided.dragHandleProps}>{overlayMapLayers[rubric.source.index].name}</span>
        <div className="map-manager-item-sub-layer-container">
          {overlayMapLayers[rubric.source.index].subLayers && overlayMapLayers[rubric.source.index].subLayers!.length > 1 &&
            <SubLayersPopupButton mapLayerSettings={overlayMapLayers[rubric.source.index]} activeViewport={activeViewport} />
          }
        </div>
        <MapLayerSettingsMenu activeViewport={activeViewport} mapLayerSettings={overlayMapLayers[rubric.source.index]} onMenuItemSelection={handleOnMenuItemSelection} />
      </div>
    );
  };

  const renderUnderlayItem: DraggableChildrenFn = (underlayDragProvided, _, rubric) => {
    assert(backgroundMapLayers !== undefined);
    return (
      <div className="map-manager-source-item" data-id={rubric.source.index} key={backgroundMapLayers[rubric.source.index].name}
        {...underlayDragProvided.draggableProps}
        ref={underlayDragProvided.innerRef} >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={() => { handleVisibilityChange(backgroundMapLayers[rubric.source.index]); }}>
          <Icon iconSpec={backgroundMapLayers[rubric.source.index].visible ? "icon-visibility" : "icon-visibility-hide-2"} /></button>
        <span className="map-manager-item-label" {...underlayDragProvided.dragHandleProps}>{backgroundMapLayers[rubric.source.index].name}</span>
        <div className="map-manager-item-sub-layer-container">
          {backgroundMapLayers[rubric.source.index].subLayers && backgroundMapLayers[rubric.source.index].subLayers!.length > 1 &&
            <SubLayersPopupButton mapLayerSettings={backgroundMapLayers[rubric.source.index]} activeViewport={activeViewport} />
          }
        </div>
        <MapLayerSettingsMenu activeViewport={activeViewport} mapLayerSettings={backgroundMapLayers[rubric.source.index]} onMenuItemSelection={handleOnMenuItemSelection} />
      </div>
    );
  };

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
      <div className="map-manager-container">
        <div className="map-manager-basemap">
          <BasemapPanel />
        </div>
        {!hideExternalMapLayersSection &&
          <DragDropContext onDragEnd={handleOnMapLayerDragEnd}>
            <div className="map-manager-underlays" >
              <span className="map-manager-underlays-label">{underlaysLabel}</span><AttachLayerPopupButton isOverlay={false} />
            </div>
            <Droppable
              droppableId="backgroundMapLayers"
              renderClone={renderUnderlayItem}
              getContainerForClone={props.getContainerForClone as any}
            >
              {(underlayDropProvided, underlayDropSnapshot) =>
                <div className={`map-manager-attachments${underlayDropSnapshot.isDraggingOver ? " is-dragging-map-over" : ""}`} ref={underlayDropProvided.innerRef} {...underlayDropProvided.droppableProps}>
                  {
                    (backgroundMapLayers && backgroundMapLayers.length > 0) ?
                      backgroundMapLayers.map((mapLayerSettings, i) =>
                        <Draggable key={mapLayerSettings.name} draggableId={mapLayerSettings.name} index={i}>
                          {renderUnderlayItem}
                        </Draggable>) :
                      <div title={noBackgroundMapsSpecifiedLabel} className="map-manager-no-layers-label">{noBackgroundMapsSpecifiedLabel}</div>
                  }
                  {underlayDropProvided.placeholder}
                </div>}
            </Droppable>
            <div className="map-manager-overlays" >
              <span className="map-manager-overlays-label">{overlaysLabel}</span><AttachLayerPopupButton isOverlay={true} />
            </div>
            <Droppable
              droppableId="overlayMapLayers"
              renderClone={renderOverlayItem}
              getContainerForClone={props.getContainerForClone as any}
            >
              {(overlayDropProvided, overlayDropSnapshot) => (
                <div className={`map-manager-attachments${overlayDropSnapshot.isDraggingOver ? " is-dragging-map-over" : ""}`} ref={overlayDropProvided.innerRef} {...overlayDropProvided.droppableProps} >
                  {
                    (overlayMapLayers && overlayMapLayers.length > 0) ?
                      overlayMapLayers.map((mapLayerSettings, i) =>
                        <Draggable key={mapLayerSettings.name} draggableId={mapLayerSettings.name} index={i}>
                          {renderOverlayItem}
                        </Draggable>) :
                      <div title={noUnderlaysSpecifiedLabel} className="map-manager-no-layers-label">{noUnderlaysSpecifiedLabel}</div>
                  }
                  {overlayDropProvided.placeholder}
                </div>)
              }
            </Droppable>
          </DragDropContext>
        }
        <div className="map-manager-settings-container">
          <MapSettingsPanel />
        </div>
      </div >
    </SourceMapContext.Provider >
  );
}
