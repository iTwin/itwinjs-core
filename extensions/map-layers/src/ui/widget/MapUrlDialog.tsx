/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Dialog, DialogButtonType, Input, Radio, Select } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { MapLayersUiItemsProvider, MapTypesOptions } from "../MapLayersUiItemsProvider";
import { IModelApp, MapLayerSettingsService, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

import "./MapUrlDialog.scss";
import { WmsAuthenticationInput } from "./WmsAuthenticationInputs";

export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog({ isOverlay, onOkResult, mapTypesOptions }: { isOverlay: boolean, onOkResult: () => void, mapTypesOptions: MapTypesOptions | undefined }) {

  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Name"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.URL"));
  const [projectSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnProjectSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnModelSettings"));
  const [wmsServerUsername, setWmsServerUsername] = React.useState("");
  const [wmsServerPassword, setWmsServerPassword] = React.useState("");
  const [warningAuthenticationSettings] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.WarningAuthenticationSettings"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("Project");
  const [skipSettingsStorage, setSkipSettingsStorage] = React.useState(false);
  const [mapType, setMapType] = React.useState(MAP_TYPES.arcGis);
  const [mapTypes] = React.useState((): string[] => {
    const types = [MAP_TYPES.arcGis, MAP_TYPES.wms, MAP_TYPES.wmts];
    if (mapTypesOptions?.supportTileUrl)
      types.push(MAP_TYPES.tileUrl);
    return types;
  });
  const [wmsAuthenticationSupported] = React.useState(() =>
    mapTypesOptions?.supportWmsAuthentication ? true : false);

  const handleMapTypeSelection = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMapType(e.target.value);
    e.preventDefault();
  }, [setMapType]);

  const handleCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const doAttach = React.useCallback((source: MapLayerSource) => {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined || source === undefined || vp.iModel === undefined || vp.iModel.contextId === undefined || vp.iModel.iModelId === undefined)
      return;

    const storeOnIModel = "Model" === settingsStorage;
    source.validateSource().then(async (validation) => {
      if (validation.status === MapLayerSourceStatus.Valid) {
        source.subLayers = validation.subLayers;
        // We don't save the source if it has an authentication set on it for right now.
        if (!skipSettingsStorage) {
          if (!(await MapLayerSettingsService.storeSourceInSettingsService(source, storeOnIModel, vp.iModel.contextId!, vp.iModel.iModelId!)))
            return;
        }
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

  }, [isOverlay, onOkResult, settingsStorage, skipSettingsStorage]);

  const [mapUrl, setMapUrl] = React.useState("");
  const [mapName, setMapName] = React.useState("");

  const onNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapName(event.target.value);
  }, [setMapName]);

  const onRadioChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsStorageRadio(event.target.value);
  }, [setSettingsStorageRadio]);

  const onUrlChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(event.target.value);
  }, [setMapUrl]);

  const handleOk = React.useCallback(() => {
    if (mapUrl && mapName) {
      const source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType,
        userName: wmsServerUsername,
        password: wmsServerPassword,
      });
      if (source)
        doAttach(source);
    }
    ModalDialogManager.closeDialog();
  }, [doAttach, mapName, mapUrl, mapType, wmsServerUsername, wmsServerPassword]);
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
            {mapType === MAP_TYPES.wms && wmsAuthenticationSupported &&
              <WmsAuthenticationInput mapType={mapType}
                wmsServerUrl={mapUrl}
                setSettingsStorageRadio={setSettingsStorageRadio}
                setWmsServerUsername={setWmsServerUsername}
                setWmsServerPassword={setWmsServerPassword}
                setSkipSettingsStorage={setSkipSettingsStorage} />
            }
            <div title={skipSettingsStorage ? warningAuthenticationSettings : ""}>
              <Radio disabled={skipSettingsStorage}
                name="settingsStorage" value="Project"
                label={projectSettingsLabel} checked={settingsStorage === "Project"}
                onChange={onRadioChange} />
              <Radio disabled={skipSettingsStorage}
                name="settingsStorage" value="Model"
                label={modelSettingsLabel} checked={settingsStorage === "Model"}
                onChange={onRadioChange} />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
