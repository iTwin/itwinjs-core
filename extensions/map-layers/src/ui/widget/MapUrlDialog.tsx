/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Dialog, DialogButtonType, Input, InputStatus, LabeledInput, Radio, Select } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapTypesOptions, StyleMapLayerSettings } from "../Interfaces";
import { IModelApp, MapLayerSettingsService, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, ScreenViewport } from "@bentley/imodeljs-frontend";

import "./MapUrlDialog.scss";
import { MapLayerSettings, MapLayerStatus } from "@bentley/imodeljs-common";

export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
};

interface MapUrlDialogProps {
  isOverlay: boolean;
  onOkResult: () => void;
  mapTypesOptions?: MapTypesOptions;
  layerToEdit?: StyleMapLayerSettings;
  activeViewport?: ScreenViewport;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog(props: MapUrlDialogProps) {

  const { isOverlay, onOkResult, mapTypesOptions } = props;

  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate(props.layerToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Name"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.URL"));
  const [projectSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnProjectSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnModelSettings"));

  const [layerIdxToEdit] = React.useState((): number | undefined => {
    if (props.layerToEdit === undefined) {
      return undefined;
    }

    const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(props.layerToEdit.name, props.layerToEdit.url, props.layerToEdit.isOverlay);
    if (indexInDisplayStyle === undefined || indexInDisplayStyle < 0) {
      return undefined;
    } else {
      return indexInDisplayStyle;
    }
  });

  const [layerToEdit] = React.useState((): MapLayerSettings | undefined => {
    if (props.layerToEdit === undefined || layerIdxToEdit === undefined) {
      return undefined;
    }

    return props.activeViewport?.displayStyle.mapLayerAtIndex(layerIdxToEdit, props.layerToEdit.isOverlay);
  });

  const [editMode] = React.useState(layerToEdit !== undefined);
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Password"));
  const [userNameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Username"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("Project");

  // Is Setting service available (i.e. should we should the options in the UI and attempt to save to settings service)
  const [settingsStorageAvailable] = React.useState(!editMode && !!IModelApp.viewManager?.selectedView?.iModel?.contextId && !!IModelApp.viewManager?.selectedView?.iModel?.iModelId);

  // Even though the settings storage is available, we might want to disable it in the UI
  const [settingsStorageDisabled, setSettingsStorageDisabled] = React.useState(settingsStorageAvailable);
  const [mapType, setMapType] = React.useState(layerToEdit?.formatId ?? MAP_TYPES.arcGis);

  const [mapTypes] = React.useState((): string[] => {
    const types = [MAP_TYPES.arcGis, MAP_TYPES.wms, MAP_TYPES.wmts];
    if (mapTypesOptions?.supportTileUrl)
      types.push(MAP_TYPES.tileUrl);
    return types;
  });

  const [authSupported] = React.useState(() =>
    (mapType === MAP_TYPES.wms && (mapTypesOptions?.supportWmsAuthentication ? true : false))
    || mapType === MAP_TYPES.arcGis);

  const handleMapTypeSelection = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMapType(e.target.value);
    e.preventDefault();
  }, [setMapType]);

  const handleCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const onWmsUsernameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
  }, [setUserName]);

  const onWmsPasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  }, [setPassword]);

  React.useEffect(() => {
    if (settingsStorageAvailable) {
      setSettingsStorageDisabled(mapType === MAP_TYPES.wms && (userName.length > 0 || password.length > 0));
    }
  }, [mapType, userName, password, setSettingsStorageDisabled, settingsStorageAvailable]);

  const doAttach = React.useCallback((source: MapLayerSource) => {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined || source === undefined)
      return;

    const storeOnIModel = "Model" === settingsStorage;
    source.validateSource().then(async (validation) => {
      if (validation.status === MapLayerSourceStatus.Valid) {
        source.subLayers = validation.subLayers;

        if (!settingsStorageDisabled) {
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

  }, [isOverlay, onOkResult, settingsStorage, settingsStorageDisabled]);

  const [mapUrl, setMapUrl] = React.useState(layerToEdit?.url ?? "");
  const [mapName, setMapName] = React.useState(layerToEdit?.name ?? "");

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
    if (layerToEdit && layerIdxToEdit !== undefined && props.layerToEdit && props.activeViewport?.displayStyle) {
      const source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType,
        userName,
        password,
      });

      if (source) {

        source.validateSource().then(async (validation) => {
          if (validation.status === MapLayerSourceStatus.Valid && props?.activeViewport) {
            source.subLayers = validation.subLayers;
            props.activeViewport.displayStyle.changeMapLayerProps({
              userName,
              password,
              subLayers: validation.subLayers,
            }, layerIdxToEdit, isOverlay);
            const layerSettings = props.activeViewport.displayStyle.mapLayerAtIndex(layerIdxToEdit, isOverlay);
            if (layerSettings) {
              layerSettings.status = MapLayerStatus.Valid;
            }

            props.activeViewport.invalidateRenderPlan();
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
      }
    } else {
      if (mapUrl && mapName) {
        const source = MapLayerSource.fromJSON({
          url: mapUrl,
          name: mapName,
          formatId: mapType,
          userName,
          password,
        });
        if (source)
          doAttach(source);
      }

    }
    ModalDialogManager.closeDialog();
  }, [doAttach, mapName, mapUrl, mapType, userName, password, isOverlay, layerIdxToEdit, layerToEdit, onOkResult, props]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const requireCredentials = React.useCallback(() => { return (layerToEdit && layerToEdit.status === MapLayerStatus.RequireAuth); }, [layerToEdit]);

  const readyToSave = React.useCallback(() => {
    const credentialsSet = !!userName && !!password;
    return (!!mapUrl && !!mapName) && (!requireCredentials() || (requireCredentials() && credentialsSet));
  }, [mapUrl, mapName, userName, password, requireCredentials]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [readyToSave, handleCancel, handleOk]);

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
            <Select className="map-manager-base-select" options={mapTypes} value={mapType} disabled={editMode} onChange={handleMapTypeSelection} />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input placeholder="Enter Map Name" onChange={onNameChange} value={layerToEdit?.name} disabled={editMode} />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input placeholder="Enter Map Source URL" onChange={onUrlChange} value={layerToEdit?.url} disabled={editMode} />
            {authSupported &&
              <>
                <span className="map-layer-source-label">{userNameLabel}</span>
                <LabeledInput placeholder={requireCredentials() ? "Username required" : userNameLabel}
                  status={!!!userName && requireCredentials() ? InputStatus.Warning : undefined}
                  onChange={onWmsUsernameChange} />

                <span className="map-layer-source-label">{passwordLabel}</span>
                <LabeledInput type="password" placeholder={requireCredentials() ? "Password required" : passwordLabel}
                  status={!!!password && requireCredentials() ? InputStatus.Warning : undefined}
                  onChange={onWmsPasswordChange} />
              </>
            }
            {/* Store settings options, not shown when  editing a layer */}
            {settingsStorageAvailable && <div title={settingsStorageDisabled ? noSaveSettingsWarning : ""}>
              <Radio disabled={settingsStorageDisabled}
                name="settingsStorage" value="Project"
                label={projectSettingsLabel} checked={settingsStorage === "Project"}
                onChange={onRadioChange} />
              <Radio disabled={settingsStorageDisabled}
                name="settingsStorage" value="Model"
                label={modelSettingsLabel} checked={settingsStorage === "Model"}
                onChange={onRadioChange} />
            </div>}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
