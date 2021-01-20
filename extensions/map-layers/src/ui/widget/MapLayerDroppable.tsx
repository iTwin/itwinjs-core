/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

// the following quiet warning caused by react-beautiful-dnd package
/* eslint-disable @typescript-eslint/unbound-method */

import * as React from "react";
import { Draggable, DraggableChildrenFn, Droppable, DroppableProvided, DroppableStateSnapshot } from "react-beautiful-dnd";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { MapLayerStatus } from "@bentley/imodeljs-common";
import { Button, Icon } from "@bentley/ui-core";
import { assert } from "@bentley/bentleyjs-core";
import { SubLayersPopupButton } from "./SubLayersPopupButton";
import { AttachLayerButtonType, AttachLayerPopupButton } from "./AttachLayerPopupButton";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import "./MapLayerManager.scss";
import { MapTypesOptions, StyleMapLayerSettings } from "../Interfaces";
import { MapLayerSettingsMenu } from "./MapLayerSettingsMenu";
import { MapUrlDialog } from "./MapUrlDialog";
import { ModalDialogManager } from "@bentley/ui-framework";

/** @internal */
interface MapLayerDroppableProps {
  isOverlay: boolean;
  layersList?: StyleMapLayerSettings[];
  mapTypesOptions?: MapTypesOptions;
  getContainerForClone: () => HTMLElement;
  activeViewport: ScreenViewport;
  onMenuItemSelected: (action: string, mapLayerSettings: StyleMapLayerSettings) => void;
  onItemVisibilityToggleClicked: (mapLayerSettings: StyleMapLayerSettings) => void;
  onItemEdited: () => void;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerDroppable(props: MapLayerDroppableProps) {
  const containsLayer = props.layersList && props.layersList.length > 0;
  const droppableId = props.isOverlay ? "overlayMapLayers" : "backgroundMapLayers";
  const [toggleVisibility] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.ToggleVisibility"));
  const [noBackgroundMapsSpecifiedLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.NoBackgroundLayers"));
  const [noUnderlaysSpecifiedLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.NoOverlayLayers"));
  const [dropLayerLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.DropLayerLabel"));

  const renderItem: DraggableChildrenFn = (dragProvided, _, rubric) => {
    assert(props.layersList !== undefined);
    const activeLayer = props.layersList[rubric.source.index];

    return (
      <div className="map-manager-source-item" data-id={rubric.source.index} key={activeLayer.name}
        {...dragProvided.draggableProps}
        ref={dragProvided.innerRef} >
        <button className="map-manager-item-visibility" title={toggleVisibility} onClick={() => { props.onItemVisibilityToggleClicked(activeLayer); }}>
          <Icon iconSpec={activeLayer.visible ? "icon-visibility" : "icon-visibility-hide-2"} /></button>
        <span className="map-manager-item-label" {...dragProvided.dragHandleProps}>{activeLayer.name}</span>
        <div className="map-manager-item-sub-layer-container">
          {activeLayer.subLayers && activeLayer.subLayers.length > 1 &&
            <SubLayersPopupButton mapLayerSettings={activeLayer} activeViewport={props.activeViewport} />
          }
        </div>
        {activeLayer.status == MapLayerStatus.RequireAuth &&
          <Button className="map-manager-item-visibility"
            onClick={() => {
              ModalDialogManager.openDialog(<MapUrlDialog activeViewport={props.activeViewport} isOverlay={props.isOverlay} layerToEdit={activeLayer} onOkResult={props.onItemEdited} mapTypesOptions={props.mapTypesOptions} />);
            }}
            title={toggleVisibility}
          >
            <Icon iconSpec="icon-status-error" />
          </Button>
        }
        <MapLayerSettingsMenu activeViewport={props.activeViewport} mapLayerSettings={activeLayer} onMenuItemSelection={props.onMenuItemSelected} />
      </div>
    );
  };

  function renderDraggableContent(snapshot: DroppableStateSnapshot): React.ReactNode {
    let node: React.ReactNode;
    if (containsLayer) {
      // Render a <Draggable>
      node = (props.layersList?.map((mapLayerSettings, i) =>
        <Draggable key={mapLayerSettings.name} draggableId={mapLayerSettings.name} index={i}>
          {renderItem}
        </Draggable>));
    } else {
      // Render a label that provide a 'Drop here' hint
      const label = props.isOverlay ? noUnderlaysSpecifiedLabel : noBackgroundMapsSpecifiedLabel;
      node =
        <div title={label} className="map-manager-no-layers-container">
          {snapshot.isDraggingOver ?
            <span className="map-manager-no-layers-label">{dropLayerLabel}</span>
            :
            <>
              <span className="map-manager-no-layers-label">{label}</span>
              <AttachLayerPopupButton buttonType={AttachLayerButtonType.Blue} isOverlay={false} />
            </>
          }
        </div>;
    }
    return node;
  }

  function renderDraggable(dropProvided: DroppableProvided, dropSnapshot: DroppableStateSnapshot): React.ReactElement<HTMLElement> {
    return (
      <div className={`map-manager-attachments${dropSnapshot.isDraggingOver && containsLayer ? " is-dragging-map-over" : ""}`} ref={dropProvided.innerRef} {...dropProvided.droppableProps} >

        {renderDraggableContent(dropSnapshot)}

        {
          /* We don't want a placeholder when displaying the 'Drop here' message
              Unfortunately, if don't add it, 'react-beautiful-dnd' show an error message in the console.
              So I simply make it hidden. See https://github.com/atlassian/react-beautiful-dnd/issues/518 */
        }
        <div style={containsLayer ? undefined : { display: "none" }}>{dropProvided.placeholder}</div>
      </div>);
  }

  return (
    <Droppable
      droppableId={droppableId}
      renderClone={renderItem}
      getContainerForClone={props.getContainerForClone as any}
    >
      {renderDraggable}
    </Droppable>
  );
}
