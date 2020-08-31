/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Dialog, DialogButtonType, Input, Select } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import "./MapUrlDialog.scss";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog({ isOverlay, onOkResult }: { isOverlay: boolean, onOkResult: () => void }) {
  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Name"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.URL"));
  const [mapTypes] = React.useState(["ArcGIS", "WMS", "WMTS", "TileURL"]);
  const [mapType, setMapType] = React.useState("ArcGIS");

  const handleMapTypeSelection = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMapType(e.target.value);
    e.preventDefault();
  }, [setMapType]);

  const handleCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const doAttach = React.useCallback((source: MapLayerSource) => {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined || source === undefined)
      return;

    source.validateSource().then((validation) => {
      if (validation.status === MapLayerSourceStatus.Valid) {
        source.subLayers = validation.subLayers;
        vp.displayStyle.attachMapLayer(source, isOverlay);
        vp.invalidateRenderPlan();
        const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.AttacheInfo");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `[${source.name}] ${msg} ${source.url}`));
        onOkResult();
      } else {
        const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.ValidationError");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `${msg} ${source.url}`));
      }
    }).catch((error) => {
      const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.AttachError");
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `${msg} ${source.url}-${error}`));
    });

  }, [isOverlay, onOkResult]);

  const [mapUrl, setMapUrl] = React.useState("");
  const [mapName, setMapName] = React.useState("");

  const onNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapName(event.target.value);
  }, [setMapName]);

  const onUrlChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(event.target.value);
  }, [setMapUrl]);

  const handleOk = React.useCallback(() => {
    if (mapUrl && mapName) {
      const source = MapLayerSource.fromJSON({ url: mapUrl, name: mapName, formatId: mapType });
      if (source)
        doAttach(source);
    }
    ModalDialogManager.closeDialog();
  }, [doAttach, mapName, mapUrl, mapType]);
  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !(!!mapUrl && !!mapName) },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [mapUrl, mapName, handleCancel, handleOk]);

  return (
    <div ref={dialogContainer}>
      <Dialog
        style={{ zIndex: 21000 }}
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={120}
        maxWidth={600}
        trapFocus={false}
      >
        <div>
          <div className="map-layer-source-url">
            <span className="map-layer-source-label">{typeLabel}</span>
            <Select className="map-manager-base-select" options={mapTypes} value={mapType} onChange={handleMapTypeSelection} />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input placeholder="Enter Map Name" onChange={onNameChange} />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input placeholder="Enter Map Source URL" onChange={onUrlChange} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
