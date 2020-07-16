import "./MapLayerManager.scss";
import "./ExpandableBlock.scss";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import * as React from "react";
import { DragDropContext, Draggable, DraggableChildrenFn, Droppable, DropResult } from "react-beautiful-dnd";
import { ColorByName, ColorDef, MapLayerProps, MapLayerSettings, MapSubLayerProps, MapSubLayerSettings } from "@bentley/imodeljs-common";
import {
  DisplayStyleState, IModelApp, MapLayerSource, MapLayerSources, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority,
  ScreenViewport, Viewport,
} from "@bentley/imodeljs-frontend";
import { ColorSwatch, UiComponents } from "@bentley/ui-components";
import { Button, ContextMenu, ContextMenuItem, Icon, Input, LoadingSpinner, OptionType, SpinnerSize, ThemedSelect } from "@bentley/ui-core";
import { ActionMeta, ValueType } from "react-select/src/types";
import { ModalDialogManager } from "@bentley/ui-framework";
import { assert } from "@bentley/ui-ninezone";
import { BasemapColorDialog } from "./BasemapColorDialog";
import { ExpandableBlock } from "./ExpandableBlock";
import { Listbox, ListboxItem } from "./Listbox";
import { MapUrlDialog } from "./MapUrlDialog";
import { SubLayersPopupButton } from "./SubLayersPopupButton";
import { TransparencyPopupButton } from "./TransparencyPopupButton";

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
}

function MapLayerSettingsMenu({ mapLayerSettings, onMenuItemSelection, activeViewport }: { mapLayerSettings: StyleMapLayerSettings, onMenuItemSelection: (action: string, mapLayerSettings: StyleMapLayerSettings) => void, activeViewport: ScreenViewport }) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLElement>(null);
  const [labelDetach] = React.useState("Detach");
  const [labelZoomToLayer] = React.useState("Zoom To Layer");
  const [hasRangeData, setHasRangeData] = React.useState<boolean | undefined>();

  React.useEffect(() => {
    async function fetchRangeData() {
      let hasRange = false;
      const indexInDisplayStyle = activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(mapLayerSettings.name, mapLayerSettings.url, mapLayerSettings.isOverlay);
      if (undefined !== indexInDisplayStyle) {
        hasRange = (undefined !== await activeViewport.displayStyle.getMapLayerRange(indexInDisplayStyle, mapLayerSettings.isOverlay));
      }
      setHasRangeData(hasRange);
    }
    fetchRangeData(); // tslint:disable-line: no-floating-promises
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

  return (
    <>
      <span data-testid="map-layer-settings" className="map-layer-settings icon icon-more-vertical-2" ref={settingsRef} onClick={onSettingsClick} ></span>
      <ContextMenu opened={isSettingsOpen && (undefined !== hasRangeData)} onOutsideClick={handleCloseSetting} >
        <ContextMenuItem key={0} className={hasRangeData ? "" : "core-context-menu-disabled"} onSelect={handleZoomToLayer}>{labelZoomToLayer}</ContextMenuItem>
        <ContextMenuItem key={1} onSelect={handleRemoveLayer}>{labelDetach}</ContextMenuItem>
      </ContextMenu>
      {
        /*
        <Popup
          isOpen={isSettingsOpen && (undefined !== hasRangeData)}
          position={RelativePosition.BottomLeft}
          onClose={handleCloseSetting}
          target={settingsRef.current}
          style={{ zIndex: 14000 }}>
          <div className="map-layer-settings-popup-panel">
            <ContextMenuItem key={0} className={hasRangeData ? "" : "core-context-menu-disabled"} onSelect={handleZoomToLayer}>{labelZoomToLayer}</ContextMenuItem>
            <ContextMenuItem key={1} onSelect={handleRemoveLayer}>{labelDetach}</ContextMenuItem>
          </div>
        </Popup>
        */
      }
    </>
  );
}

function getSubLayerProps(subLayerSettings: MapSubLayerSettings[]): MapSubLayerProps[] {
  return subLayerSettings.map((subLayer) => subLayer.toJSON());
}

function getBaseMapFromStyle(displayStyle: DisplayStyleState | undefined) {
  if (!displayStyle)
    return undefined;

  if (displayStyle.settings.mapImagery.backgroundBase instanceof MapLayerSettings || displayStyle.settings.mapImagery.backgroundBase instanceof ColorDef)
    return displayStyle.settings.mapImagery.backgroundBase.toJSON();

  return undefined;
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
      });
    });
  }

  // since we want to display higher level maps above lower maps in UI reverse their order here.
  return layers.reverse();
}

interface MapLayerManagerProps {
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
}

export function MapLayerManager(props: MapLayerManagerProps) {
  const [mapSources, setMapSources] = React.useState<MapLayerSource[] | undefined>();
  const [baseSources, setBaseSources] = React.useState<MapLayerSource[] | undefined>();
  const [overlaysLabel] = React.useState("Overlay");
  const [underlaysLabel] = React.useState("Background");
  const [addNewSourceLabel] = React.useState("Add New Map Source");
  const [noBackgroundMapsSpecifiedLabel] = React.useState("No Background layers specified");
  const [noUnderlaysSpecifiedLabel] = React.useState("No Overlay layers specified");
  const [useColorLabel] = React.useState("Solid Fill Color");
  const [loadingMapSources] = React.useState("Loading Map Sources");
  const [toggleVisibility] = React.useState("Toggle Visibility");
  const [layerNameToAdd, setLayerNameToAdd] = React.useState<string | undefined>();
  const [newLayerIsOverlay, setNewLayerIsOverlay] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const { activeViewport } = props;
  // map layer settings from display style
  const [selectedBaseMap, setSelectedBaseMap] = React.useState<MapLayerProps | number | undefined>(getBaseMapFromStyle(activeViewport?.displayStyle));
  const [backgroundMapLayers, setBackgroundMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromStyle(activeViewport?.displayStyle, true));
  const [overlayMapLayers, setOverlayMapLayers] = React.useState<StyleMapLayerSettings[] | undefined>(getMapLayerSettingsFromStyle(activeViewport?.displayStyle, false));
  const [sourceFilterString, setSourceFilterString] = React.useState<string | undefined>();

  const loadMapLayerSettingsFromStyle = React.useCallback((displayStyle: DisplayStyleState) => {
    setBackgroundMapLayers(getMapLayerSettingsFromStyle(displayStyle, true));
    setOverlayMapLayers(getMapLayerSettingsFromStyle(displayStyle, false));
  }, [setBackgroundMapLayers, setOverlayMapLayers]);

  const styleContainsLayer = React.useCallback((name: string) => {
    if (backgroundMapLayers) {
      if (-1 !== backgroundMapLayers.findIndex((layer) => layer.name === name))
        return true;
    }
    if (overlayMapLayers) {
      if (-1 !== overlayMapLayers.findIndex((layer) => layer.name === name))
        return true;
    }
    return false;
  }, [backgroundMapLayers, overlayMapLayers]);

  React.useEffect(() => {
    async function fetchWmsMapData() {
      const sources: MapLayerSource[] = [];
      const bases: MapLayerSource[] = [];
      const sourceLayers = await MapLayerSources.create();
      sourceLayers?.layers.forEach((source: MapLayerSource) => {
        sources.push(source);
      });
      setMapSources(sources);

      sourceLayers?.bases.forEach((source: MapLayerSource) => {
        bases.push(source);
      });
      setBaseSources(bases);
    }
    fetchWmsMapData(); // tslint:disable-line: no-floating-promises
  }, [setMapSources]);

  const baseMapOptions = React.useMemo<OptionType[]>(() => {
    const baseOptions: OptionType[] = [];
    baseOptions.push({ value: useColorLabel, label: useColorLabel });

    if (baseSources)
      baseOptions.push(...baseSources.map((value) => ({ value: value.name, label: value.name })));
    return baseOptions;
  }, [baseSources, useColorLabel]);

  const options = React.useMemo(() => mapSources?.filter((source) => !styleContainsLayer(source.name)).map((value) => value.name), [mapSources, styleContainsLayer]);
  const filteredOptions = React.useMemo(() => {
    if (undefined === sourceFilterString || 0 === sourceFilterString.length) {
      return options;
    } else {
      return options?.filter((option) => option.toLowerCase().includes(sourceFilterString?.toLowerCase()));
    }
  }, [options, sourceFilterString]);

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

  const handleBackgroundColorDialogOk = React.useCallback((bgColor: ColorDef) => {
    if (activeViewport) {
      activeViewport.displayStyle.changeBaseMapProps(bgColor);
      activeViewport.invalidateRenderPlan();
      setSelectedBaseMap(bgColor.toJSON());
    }
  }, [activeViewport]);

  const handleBaseMapSelection = React.useCallback((value: ValueType<OptionType>, action: ActionMeta<OptionType>) => {
    if (baseSources && activeViewport && action.action === "select-option" && value) {
      const baseMap = baseSources.find((map) => map.name === (value as OptionType).label);
      if (baseMap) {
        const baseProps: MapLayerProps = baseMap.toJSON();
        activeViewport.displayStyle.changeBaseMapProps(baseProps);
        activeViewport.invalidateRenderPlan();
        setSelectedBaseMap(baseProps);
      } else {
        ModalDialogManager.openDialog(<BasemapColorDialog color={presetColors[0]} colorPresets={presetColors} onOkResult={handleBackgroundColorDialogOk} />);
      }
    }
  }, [baseSources, activeViewport, presetColors, handleBackgroundColorDialogOk]);

  const baseIsColor = React.useMemo(() => typeof selectedBaseMap === "number", [selectedBaseMap]);
  const baseIsMap = React.useMemo(() => !baseIsColor && (selectedBaseMap !== undefined), [baseIsColor, selectedBaseMap]);

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

  const handleModalUrlDialogOk = React.useCallback(() => {
    // force UI to update
    if (activeViewport)
      loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
  }, [activeViewport, loadMapLayerSettingsFromStyle]);

  const handleAddNewMapSource = React.useCallback(() => {
    setNewLayerIsOverlay(false);

    ModalDialogManager.openDialog(<MapUrlDialog isOverlay={false} onOkResult={handleModalUrlDialogOk} />);
    return;
  }, [handleModalUrlDialogOk]);

  React.useEffect(() => {
    async function attemptToAddLayer(layerName: string) {
      if (layerName && activeViewport) {
        // if the layer is not in the style add it now.
        if (undefined === backgroundMapLayers?.find((layer) => layerName === layer.name) && undefined === overlayMapLayers?.find((layer) => layerName === layer.name)) {
          const mapLayerSettings = mapSources?.find((source) => source.name === layerName);
          if (mapLayerSettings) {
            try {
              setLoading(true);
              const { status, subLayers } = await mapLayerSettings.validateSource();
              if (status === MapLayerSourceStatus.Valid) {
                activeViewport.displayStyle.attachMapLayer({ formatId: mapLayerSettings.formatId, name: mapLayerSettings.name, url: mapLayerSettings.url, maxZoom: mapLayerSettings.maxZoom, subLayers }, newLayerIsOverlay);
                activeViewport.invalidateRenderPlan();
                setLoading(false);
                loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
              } else {
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `Invalid response from URL: ${mapLayerSettings.url}`));
                setLoading(false);
              }
            } catch (err) {
              setLoading(false);
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Error loading map layers", err.toString()));
            }
          }
        }
      }
      return;
    }

    if (layerNameToAdd) {
      attemptToAddLayer(layerNameToAdd); // tslint:disable-line: no-floating-promises
      setLayerNameToAdd(undefined);
    }
  }, [setLayerNameToAdd, layerNameToAdd, activeViewport, mapSources, loadMapLayerSettingsFromStyle, backgroundMapLayers, overlayMapLayers, newLayerIsOverlay]);

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
      case "move-top":
        activeViewport.displayStyle.moveMapLayerToTop(indexInDisplayStyle, mapLayerSettings.isOverlay);
        break;
      case "move-bottom":
        activeViewport.displayStyle.moveMapLayerToBottom(indexInDisplayStyle, mapLayerSettings.isOverlay);
        break;
      case "swap-mode":
        const layerProps = activeViewport.displayStyle.mapLayerAtIndex(indexInDisplayStyle, mapLayerSettings.isOverlay)?.toJSON();
        if (layerProps) {
          activeViewport.displayStyle.detachMapLayerByIndex(indexInDisplayStyle, mapLayerSettings.isOverlay);
          activeViewport.displayStyle.attachMapLayer(layerProps, !mapLayerSettings.isOverlay);
        }
        break;
      case "toggle-transparent-background":
        activeViewport.displayStyle.changeMapLayerProps({ transparentBackground: !mapLayerSettings.transparentBackground }, indexInDisplayStyle, mapLayerSettings.isOverlay);
        break;
      case "zoom-to-layer":
        activeViewport.displayStyle.viewMapLayerRange(indexInDisplayStyle, mapLayerSettings.isOverlay, activeViewport).then((status) => {
          if (!status)
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `No range is defined for Map Layer: ${mapLayerSettings.name}`));
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

  const handleTransparencyChange = React.useCallback((value: number, mapLayerSettings: StyleMapLayerSettings) => {
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
          loadMapLayerSettingsFromStyle(activeViewport.displayStyle);
        }
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

  const renderOverlayItem: DraggableChildrenFn = (overlayDragProvided, _, rubric) => {
    assert(overlayMapLayers);

    return (
      <div className="map-manager-source-item" data-id={rubric.source.index} key={overlayMapLayers![rubric.source.index].name}
        {...overlayDragProvided.draggableProps}
        ref={overlayDragProvided.innerRef} >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={() => { handleVisibilityChange(overlayMapLayers[rubric.source.index]); }}>
          <Icon iconSpec={overlayMapLayers[rubric.source.index].visible ? "icon-visibility" : "icon-visibility-hide-2"} /></button>
        <span className="map-manager-item-label" {...overlayDragProvided.dragHandleProps}>{overlayMapLayers![rubric.source.index].name}</span>
        <div className="map-manager-item-sub-layer-container">
          {overlayMapLayers![rubric.source.index].subLayers && overlayMapLayers![rubric.source.index].subLayers!.length > 1 &&
            <SubLayersPopupButton mapLayerSettings={overlayMapLayers![rubric.source.index]} activeViewport={activeViewport} />
          }
        </div>
        <div className="map-manager-item-transparency">
          <TransparencyPopupButton transparency={overlayMapLayers[rubric.source.index].transparency as number}
            onTransparencyChange={(value) => { handleTransparencyChange(value, overlayMapLayers[rubric.source.index]); }} />
        </div>
        <span className="map-manager-item-settings-button"><MapLayerSettingsMenu activeViewport={activeViewport} mapLayerSettings={overlayMapLayers[rubric.source.index]} onMenuItemSelection={handleOnMenuItemSelection} /></span>
      </div>
    );
  };

  const renderUnderlayItem: DraggableChildrenFn = (underlayDragProvided, _, rubric) => {
    assert(backgroundMapLayers);
    return (
      <div className="map-manager-source-item" data-id={rubric.source.index} key={backgroundMapLayers![rubric.source.index].name}
        {...underlayDragProvided.draggableProps}
        ref={underlayDragProvided.innerRef} >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={() => { handleVisibilityChange(backgroundMapLayers![rubric.source.index]); }}>
          <Icon iconSpec={backgroundMapLayers![rubric.source.index].visible ? "icon-visibility" : "icon-visibility-hide-2"} /></button>
        <span className="map-manager-item-label" {...underlayDragProvided.dragHandleProps}>{backgroundMapLayers![rubric.source.index].name}</span>
        <div className="map-manager-item-sub-layer-container">
          {backgroundMapLayers![rubric.source.index].subLayers && backgroundMapLayers![rubric.source.index].subLayers!.length > 1 &&
            <SubLayersPopupButton mapLayerSettings={backgroundMapLayers![rubric.source.index]} activeViewport={activeViewport} />
          }
        </div>
        <div className="map-manager-item-transparency">
          <TransparencyPopupButton transparency={backgroundMapLayers[rubric.source.index].transparency as number}
            onTransparencyChange={(value) => { handleTransparencyChange(value, backgroundMapLayers[rubric.source.index]); }} />
        </div>
        <span className="map-manager-item-settings-button"><MapLayerSettingsMenu activeViewport={activeViewport} mapLayerSettings={backgroundMapLayers![rubric.source.index]} onMenuItemSelection={handleOnMenuItemSelection} /></span>
      </div>
    );
  };

  const [showExpandedSource, setShowExpandedSource] = React.useState(false);
  const toggleShowSource = React.useCallback(() => {
    setShowExpandedSource(!showExpandedSource);
  }, [setShowExpandedSource, showExpandedSource]);

  const handleAttachAsBackground = React.useCallback((mapName: string) => {
    setNewLayerIsOverlay(false);
    setLayerNameToAdd(mapName);
  }, []);

  const handleAttachAsOverlay = React.useCallback((mapName: string) => {
    setNewLayerIsOverlay(true);
    setLayerNameToAdd(mapName);
  }, []);

  const handleKeypressOnSourceList = React.useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (key === "Enter") {
      event.preventDefault();
      const mapName = event.currentTarget?.dataset?.value;
      if (mapName && mapName.length) {
        setNewLayerIsOverlay(false);
        setLayerNameToAdd(mapName);
      }
    }
  }, []);

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

  const [placeholderLabel] = React.useState(UiComponents.translate("filteringInput:placeholder"));
  const handleFilterTextChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceFilterString(event.target.value);
  }, []);

  const selectedBaseMapValue = React.useMemo(() => {
    if (baseIsMap) {
      const mapName = (selectedBaseMap! as MapLayerProps).name!;
      const foundItem = baseMapOptions.find((value) => value.label === mapName);
      if (foundItem)
        return foundItem;
    }
    return baseMapOptions[0];
  }, [selectedBaseMap, baseMapOptions, baseIsMap]);

  const handleBgColorClick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    ModalDialogManager.openDialog(<BasemapColorDialog color={newColor} colorPresets={presetColors} onOkResult={handleBackgroundColorDialogOk} />);
  }, [presetColors, handleBackgroundColorDialogOk]);

  /* className="map-manager-base-item-select" */
  return (
    <div className="map-manager-container">
      <div className="map-manager-basemap">
        <span className="map-manager-base-label">Base</span>
        <div className="map-manager-base-item" >
          <ThemedSelect options={baseMapOptions} closeMenuOnSelect placeholder="Select base map" value={selectedBaseMapValue} onChange={handleBaseMapSelection} />
          {
            baseIsColor &&
            <ColorSwatch className="map-manager-base-item-color" colorDef={ColorDef.fromJSON(selectedBaseMap! as number)} round={false} onColorPick={handleBgColorClick} />
          }
          <TransparencyPopupButton transparency={baseMapTransparencyValue} onTransparencyChange={handleBasemapTransparencyChange} />
        </div>
      </div>
      <div className="map-manager-header">
        <ExpandableBlock title="Sources" isExpanded={showExpandedSource} onClick={toggleShowSource}>
          <div className="map-manager-source-listbox-header">
            <Input type="text" className="map-manager-source-list-filter"
              placeholder={placeholderLabel}
              value={sourceFilterString}
              onChange={handleFilterTextChanged} />
            <Button className="map-manager-add-source-button" title={addNewSourceLabel} onClick={handleAddNewMapSource}>
              <Icon iconSpec={"icon-add"} /></Button>
          </div>
          <div className="map-manager-sources">
            <Listbox id="map-sources" className="map-manager-source-list" onKeyPress={handleKeypressOnSourceList}>
              {
                filteredOptions?.map((mapName) =>
                  <ListboxItem key={mapName} className="map-source-list-entry" value={mapName} label={mapName}>
                    <span className="map-source-list-entry-name" title={mapName}>{mapName}</span>
                    <span className="map-source-list-entry-attach" onClick={() => { handleAttachAsBackground(mapName); }} title="Attach as Background"> <Icon iconSpec={"icon-cube-faces-bottom"} /></span>
                    <span className="map-source-list-entry-attach" onClick={() => { handleAttachAsOverlay(mapName); }} title="Attach as Overlay"> <Icon iconSpec={"icon-cube-faces-top"} /></span>
                  </ListboxItem>)
              }
            </Listbox>
          </div>
        </ExpandableBlock>
      </div>
      {loading && <LoadingSpinner size={SpinnerSize.Medium} message={loadingMapSources} />}
      <DragDropContext onDragEnd={handleOnMapLayerDragEnd}>
        <div className="map-manager-underlays" >
          <span className="map-manager-underlays-label">{underlaysLabel}</span>
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
          <span className="map-manager-overlays-label">{overlaysLabel}</span>
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
    </div >
  );
}
