/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Dialog, DialogButtonType, Icon, Input, InputStatus, LabeledInput, ProgressBar, Radio, Select } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapTypesOptions } from "../Interfaces";
import {
  IModelApp, MapLayerImageryProviderStatus, MapLayerSettingsService, MapLayerSource,
  MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, ScreenViewport,
} from "@bentley/imodeljs-frontend";
import { MapLayerProps, MapLayerSettings } from "@bentley/imodeljs-common";
import "./MapUrlDialog.scss";
import { SpecialKey } from "@bentley/ui-abstract";

export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
};

interface MapUrlDialogProps {
  activeViewport?: ScreenViewport;
  isOverlay: boolean;
  onOkResult: () => void;
  onCancelResult?: () => void;
  mapTypesOptions?: MapTypesOptions;

  // An optional layer definition can be provide to enable the edit mpde
  layerToEdit?: MapLayerProps;

  // Dialog will disabled all fields except username/password, and
  //  will force user to provider
  askForCredentialsOnly?: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog(props: MapUrlDialogProps) {
  const { isOverlay, onOkResult, mapTypesOptions } = props;
  const supportWmsAuthentication = (mapTypesOptions?.supportWmsAuthentication ? true : false);

  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate(props.layerToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Name"));
  const [nameInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.NameInputPlaceHolder"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.URL"));
  const [urlInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.UrlInputPlaceHolder"));
  const [projectSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnProjectSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnModelSettings"));
  const [missingCredentialsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MissingCredentials"));
  const [invalidCredentialsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.InvalidCredentials"));
  const [serverRequireCredentials, setServerRequireCredentials] = React.useState(props.askForCredentialsOnly ?? false);
  const [invalidCredentialsProvided, setInvalidCredentialsProvided] = React.useState(false);
  const [layerAttachPending, setLayerAttachPending] = React.useState(false);
  const [warningMessage, setWarningMessage] = React.useState(props.askForCredentialsOnly ? missingCredentialsLabel : undefined);
  const [mapUrl, setMapUrl] = React.useState(props.layerToEdit?.url ?? "");
  const [mapName, setMapName] = React.useState(props.layerToEdit?.name ?? "");
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Password"));
  const [passwordRequiredLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.PasswordRequired"));
  const [userNameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Username"));
  const [userNameRequiredLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.UsernameRequired"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("Project");

  const [mapType, setMapType] = React.useState(props.layerToEdit?.formatId ?? MAP_TYPES.arcGis);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [mapTypes] = React.useState((): string[] => {
    const types = [MAP_TYPES.arcGis, MAP_TYPES.wms, MAP_TYPES.wmts];
    if (mapTypesOptions?.supportTileUrl)
      types.push(MAP_TYPES.tileUrl);
    return types;
  });

  const isSettingsStorageAvailable = React.useCallback(() => {
    return !props.askForCredentialsOnly;
  }, [props.askForCredentialsOnly]);

  // Even though the settings storage is available,
  // we don't always want to enable it in the UI.
  const [settingsStorageDisabled] = React.useState(
    !isSettingsStorageAvailable()
    || !props?.activeViewport?.iModel?.contextId
    || !props?.activeViewport?.iModel?.iModelId);

  const isAuthSupported = React.useCallback(() => {
    return ((mapType === MAP_TYPES.wms || mapType === MAP_TYPES.wms) && supportWmsAuthentication)
      || mapType === MAP_TYPES.arcGis;
  }, [mapType, supportWmsAuthentication]);

  const [layerIdxToEdit] = React.useState((): number | undefined => {
    if (props.layerToEdit === undefined || !props.layerToEdit.name || !props.layerToEdit.url) {
      return undefined;
    }

    const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(props.layerToEdit.name, props.layerToEdit.url, isOverlay);
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
    return props.activeViewport?.displayStyle.mapLayerAtIndex(layerIdxToEdit, props.isOverlay);
  });

  // Update warning message based on the dialog state and server response
  React.useEffect(() => {
    if (invalidCredentialsProvided) {
      setWarningMessage(invalidCredentialsLabel);
    } else if (serverRequireCredentials && (!userName || !password)) {
      setWarningMessage(missingCredentialsLabel);
    } else {
      setWarningMessage(undefined);
    }
  }, [invalidCredentialsProvided, invalidCredentialsLabel, missingCredentialsLabel, serverRequireCredentials, userName, password, setWarningMessage]);

  const handleMapTypeSelection = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMapType(e.target.value);
    e.preventDefault();
  }, [setMapType]);

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
    ModalDialogManager.closeDialog();
  }, [props]);

  const onUsernameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
    if (invalidCredentialsProvided)
      setInvalidCredentialsProvided(false);
  }, [setUserName, invalidCredentialsProvided, setInvalidCredentialsProvided]);

  const onPasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    if (invalidCredentialsProvided)
      setInvalidCredentialsProvided(false);
  }, [setPassword, invalidCredentialsProvided, setInvalidCredentialsProvided]);

  const doAttach = React.useCallback(async (source: MapLayerSource): Promise<boolean> => {
    // Returns a promise, When true, the dialog should closed
    return new Promise<boolean>((resolve, _reject) => {
      const vp = props?.activeViewport;
      if (vp === undefined || source === undefined) {
        resolve(true);
        return;
      }

      const storeOnIModel = "Model" === settingsStorage;
      source.validateSource(true).then(async (validation) => {
        if (validation.status === MapLayerSourceStatus.Valid
          || validation.status === MapLayerSourceStatus.RequireAuth
          || validation.status === MapLayerSourceStatus.InvalidCredentials) {
          const sourceRequireAuth = (validation.status === MapLayerSourceStatus.RequireAuth);
          const invalidCredentials = (validation.status === MapLayerSourceStatus.InvalidCredentials);
          const closeDialog = !sourceRequireAuth && !invalidCredentials;
          resolve(closeDialog);

          if (sourceRequireAuth && !serverRequireCredentials) {
            setServerRequireCredentials(true);
          }
          if (invalidCredentials) {
            setInvalidCredentialsProvided(true);
            return;
          } else if (invalidCredentialsProvided) {
            setInvalidCredentialsProvided(false);  // flag reset
          }

          if (validation.status === MapLayerSourceStatus.Valid) {
            source.subLayers = validation.subLayers;

            // Attach layer and update settings service (only if editing)
            if (layerIdxToEdit !== undefined) {
              // Update username / password
              vp.displayStyle.changeMapLayerProps({
                subLayers: validation.subLayers,
              }, layerIdxToEdit, isOverlay);
              vp.displayStyle.changeMapLayerCredentials(layerIdxToEdit, isOverlay, source.userName, source.password,);

              // Reset the provider's status
              const provider = vp.getMapLayerImageryProvider(layerIdxToEdit, isOverlay);
              if (provider && provider.status !== MapLayerImageryProviderStatus.Valid) {
                provider.status = MapLayerImageryProviderStatus.Valid;
              }
            } else {
              // Update service settings if storage is available and we are not prompting user for credentials
              if (!settingsStorageDisabled && !props.askForCredentialsOnly) {
                if (!(await MapLayerSettingsService.storeSourceInSettingsService(source, storeOnIModel, vp.iModel.contextId!, vp.iModel.iModelId!)))
                  return;
              }
              const layerSettings = source.toLayerSettings();
              if (layerSettings) {
                vp.displayStyle.attachMapLayerSettings(layerSettings, isOverlay, undefined);

                const msg = IModelApp.i18n.translate("mapLayers:Messages.MapLayerAttached", { sourceName: source.name, sourceUrl: source.url });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
              } else {
                const msgError = MapLayersUiItemsProvider.i18n.translate("mapLayers:Messages.MapLayerLayerSettingsConversionError");
                const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", {error: msgError, sourceUrl: source.url} );
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
              }
            }

            vp.invalidateRenderPlan();
          }

          if (closeDialog) {
            // This handler will close the layer source handler, and therefore the MapUrl dialog.
            // don't call it if the dialog needs to remains open.
            onOkResult();
          }

        } else {
          const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.ValidationError");
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} ${source.url}`));
          resolve(true);
        }
        resolve(false);
      }).catch((error) => {
        const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", {error, sourceUrl: source.url} );
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        resolve(true);
      });
    });
  }, [props.activeViewport, props.askForCredentialsOnly, settingsStorage, serverRequireCredentials, invalidCredentialsProvided, onOkResult, layerIdxToEdit, isOverlay, settingsStorageDisabled]);

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
    let source: MapLayerSource|undefined;
    if (mapUrl && mapName) {
      source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType,
        userName,
        password,
      });

      if (source === undefined) {
        // Close the dialog and inform end user something went wrong.
        ModalDialogManager.closeDialog();
        const msgError = MapLayersUiItemsProvider.i18n.translate("mapLayers:Messages.MapLayerLayerSourceCreationFailed");
        const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", {error: msgError, sourceUrl: mapUrl} );
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      setLayerAttachPending(true);

      // Code below is executed in the an async manner but
      // I don't necessarily  want to mark the handler as async
      // so Im wrapping it un in a void wrapper.
      void (async () => {
        try {
          const closeDialog = await doAttach(source);
          if (isMounted.current) {
            setLayerAttachPending(false);
          }

          // In theory the modal dialog should always get closed by the parent
          // AttachLayerPanel's 'onOkResult' handler.  We close it here just in case.
          if (closeDialog) {
            ModalDialogManager.closeDialog();
          }
        } catch (_error) {
          ModalDialogManager.closeDialog();
        }
      })();

    }
  }, [doAttach, mapName, mapUrl, mapType, userName, password]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const readyToSave = React.useCallback(() => {
    const credentialsSet = !!userName && !!password;
    return (!!mapUrl && !!mapName)
      && (!serverRequireCredentials || (serverRequireCredentials && credentialsSet) && !layerAttachPending)
      && !invalidCredentialsProvided;
  }, [mapUrl, mapName, userName, password, layerAttachPending, invalidCredentialsProvided, serverRequireCredentials]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [readyToSave, handleCancel, handleOk]);

  const handleOnKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === SpecialKey.Enter) {
      if (readyToSave())
        handleOk();
    }
  }, [handleOk, readyToSave]);

  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-url-dialog"
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
            <Select className="map-manager-base-select" options={mapTypes} value={mapType} disabled={props.askForCredentialsOnly} onChange={handleMapTypeSelection} />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input placeholder={nameInputPlaceHolder} onChange={onNameChange} value={props.layerToEdit?.name || layerToEdit?.name} disabled={props.askForCredentialsOnly} />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input placeholder={urlInputPlaceHolder} onKeyPress={handleOnKeyDown} onChange={onUrlChange} value={props.layerToEdit?.url || layerToEdit?.url} disabled={props.askForCredentialsOnly} />
            {isAuthSupported() &&
              <>
                <span className="map-layer-source-label">{userNameLabel}</span>
                <LabeledInput placeholder={serverRequireCredentials ? userNameRequiredLabel : userNameLabel}
                  status={!userName && serverRequireCredentials ? InputStatus.Warning : undefined}
                  onChange={onUsernameChange} />

                <span className="map-layer-source-label">{passwordLabel}</span>
                <LabeledInput type="password" placeholder={serverRequireCredentials ? passwordRequiredLabel : passwordLabel}
                  status={!password && serverRequireCredentials ? InputStatus.Warning : undefined}
                  onChange={onPasswordChange}
                  onKeyPress={handleOnKeyDown} />
              </>
            }

            {/* Store settings options, not shown when editing a layer */}
            {isSettingsStorageAvailable() && <div title={settingsStorageDisabled ? noSaveSettingsWarning : ""}>
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

        {/* Warning message */}
        <div className="map-layer-source-warnMessage">
          {warningMessage ?
            <>
              <Icon className="map-layer-source-warnMessage-icon" iconSpec="icon-status-warning" />
              <span className="map-layer-source-warnMessage-label">{warningMessage}</span >
            </>
            :
            // Place holder to avoid dialog resize
            <span className="map-layer-source-placeholder">&nbsp;</span>
          }
        </div>

        {/* Progress bar */}
        {layerAttachPending &&
          <div className="map-layer-source-progressBar">
            <ProgressBar indeterminate />
          </div>
        }
      </Dialog>
    </div >
  );
}
