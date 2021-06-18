/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Button, Dialog, DialogButtonType, Icon, Input, InputStatus, LabeledInput, ProgressBar, Radio, Select } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapTypesOptions } from "../Interfaces";
import {
  EsriOAuth2, IModelApp, MapLayerImageryProviderStatus, MapLayerSettingsService, MapLayerSource,
  MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, ScreenViewport,
} from "@bentley/imodeljs-frontend";
import { MapLayerAuthType, MapLayerProps } from "@bentley/imodeljs-common";
import "./MapUrlDialog.scss";
import { SpecialKey } from "@bentley/ui-abstract";
import useEsriOAuth2Popup from "../hooks/useEsriOAuth2Popup";

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

  // An optional layer definition can be provide to enable the edit mode
  layerRequiringCredentials?: MapLayerProps;

  mapLayerSourceToEdit?: MapLayerSource;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog(props: MapUrlDialogProps) {
  const { isOverlay, onOkResult, mapTypesOptions } = props;

  const getMapUrlFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.url;
    } else if (props.layerRequiringCredentials?.url) {
      return props.layerRequiringCredentials.url;
    }
    return "";
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const getMapNameFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.name;
    } else if (props.layerRequiringCredentials?.name) {
      return props.layerRequiringCredentials.name;
    }
    return "";
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const getFormatFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.formatId;
    } else if (props.layerRequiringCredentials?.formatId) {
      return props.layerRequiringCredentials.formatId;
    }
    return undefined;
  }, [props.layerRequiringCredentials, props.mapLayerSourceToEdit]);

  const [dialogTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate(props.layerRequiringCredentials || props.mapLayerSourceToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.Name"));
  const [nameInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.NameInputPlaceHolder"));
  const [urlLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.URL"));
  const [urlInputPlaceHolder] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.UrlInputPlaceHolder"));
  const [projectSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnProjectSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.StoreOnModelSettings"));
  const [missingCredentialsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MissingCredentials"));
  const [invalidCredentialsLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.InvalidCredentials"));
  const [serverRequireCredentials, setServerRequireCredentials] = React.useState(props.layerRequiringCredentials ?? false);
  const [invalidCredentialsProvided, setInvalidCredentialsProvided] = React.useState(false);
  const [layerAttachPending, setLayerAttachPending] = React.useState(false);
  const [layerAuthPending, setLayerAuthPending] = React.useState(false);
  const [mapUrl, setMapUrl] = React.useState(getMapUrlFromProps());
  const [mapName, setMapName] = React.useState(getMapNameFromProps());
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Password"));
  const [passwordRequiredLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.PasswordRequired"));
  const [userNameLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.Username"));
  const [userNameRequiredLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:AuthenticationInputs.UsernameRequired"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("Project");
  const [layerAuthMethod, setLayerAuthMethod] = React.useState(MapLayerAuthType.None);
  const [esriOAuth2Succeeded, setEsriOAuth2Succeeded] = React.useState<undefined|boolean>(undefined);

  const [mapType, setMapType] = React.useState(getFormatFromProps() ?? MAP_TYPES.arcGis);

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

  const [isSettingsStorageAvailable] = React.useState(props?.activeViewport?.iModel?.contextId && props?.activeViewport?.iModel?.iModelId);

  // Even though the settings storage is available,
  // we don't always want to enable it in the UI.
  const [settingsStorageDisabled] = React.useState( !isSettingsStorageAvailable|| props.mapLayerSourceToEdit !== undefined || props.layerRequiringCredentials !== undefined );

  React.useEffect(() => {
    setServerRequireCredentials(layerAuthMethod === MapLayerAuthType.Basic || layerAuthMethod === MapLayerAuthType.EsriToken);
  }, [layerAuthMethod]);

  const [layerRequiringCredentialsIdx] = React.useState((): number | undefined => {
    if (props.layerRequiringCredentials === undefined || !props.layerRequiringCredentials.name || !props.layerRequiringCredentials.url) {
      return undefined;
    }

    const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndUrl(props.layerRequiringCredentials.name, props.layerRequiringCredentials.url, isOverlay);
    if (indexInDisplayStyle === undefined || indexInDisplayStyle < 0) {
      return undefined;
    } else {
      return indexInDisplayStyle;
    }
  });

  // Update warning message based on the dialog state and server response
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

  const handleArcGisLogin = React.useCallback(() => {
    setLayerAuthPending(true);
    setShowEsriOauth2Popup(true);
    if (esriOAuth2Succeeded === false) {
      setEsriOAuth2Succeeded(undefined);
    }

  }, [esriOAuth2Succeeded]);

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
            if (validation.authMethod !== undefined) {
              setLayerAuthMethod(validation.authMethod);
              if (validation.authMethod === MapLayerAuthType.EsriOAuth2) {
                handleArcGisLogin();
              }

            }

            setServerRequireCredentials(true);

          }
          if (invalidCredentials) {
            setInvalidCredentialsProvided(true);
            return;
          } else if (invalidCredentialsProvided) {
            setInvalidCredentialsProvided(false);  // flag reset
          }

          if (validation.status === MapLayerSourceStatus.Valid) {
            // Attach layer and update settings service (only if editing)
            if (layerRequiringCredentialsIdx !== undefined) {
              // Update username / password
              vp.displayStyle.changeMapLayerProps({
                subLayers: validation.subLayers,
              }, layerRequiringCredentialsIdx, isOverlay);
              vp.displayStyle.changeMapLayerCredentials(layerRequiringCredentialsIdx, isOverlay, source.userName, source.password);

              // Reset the provider's status
              const provider = vp.getMapLayerImageryProvider(layerRequiringCredentialsIdx, isOverlay);
              if (provider && provider.status !== MapLayerImageryProviderStatus.Valid) {
                provider.status = MapLayerImageryProviderStatus.Valid;
              }
            } else {
              // Update service settings if storage is available and we are not prompting user for credentials
              if (!settingsStorageDisabled && !props.layerRequiringCredentials) {
                if (!(await MapLayerSettingsService.storeSourceInSettingsService(source, storeOnIModel, vp.iModel.contextId!, vp.iModel.iModelId!)))
                  return;
              }
              const layerSettings = source.toLayerSettings(validation.subLayers);
              if (layerSettings) {
                vp.displayStyle.attachMapLayerSettings(layerSettings, isOverlay, undefined);

                const msg = IModelApp.i18n.translate("mapLayers:Messages.MapLayerAttached", { sourceName: source.name, sourceUrl: source.url });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
              } else {
                const msgError = MapLayersUiItemsProvider.i18n.translate("mapLayers:Messages.MapLayerLayerSettingsConversionError");
                const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", { error: msgError, sourceUrl: source.url });
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
        const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", { error, sourceUrl: source.url });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        resolve(true);
      });
    });
  }, [props.activeViewport, props.layerRequiringCredentials, settingsStorage, serverRequireCredentials, invalidCredentialsProvided, handleArcGisLogin, layerRequiringCredentialsIdx, isOverlay, settingsStorageDisabled, onOkResult]);

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
    let source: MapLayerSource | undefined;
    if (mapUrl && mapName) {
      source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType,
        userName,
        password,
      });

      if (source === undefined || props.mapLayerSourceToEdit) {

        ModalDialogManager.closeDialog();

        if (source === undefined) {
          // Close the dialog and inform end user something went wrong.
          const msgError = MapLayersUiItemsProvider.i18n.translate("mapLayers:Messages.MapLayerLayerSourceCreationFailed");
          const msg = MapLayersUiItemsProvider.i18n.translate("mapLayers:CustomAttach.MapLayerAttachError", { error: msgError, sourceUrl: mapUrl });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
          return;
        }

        // Simply change the source definition in the setting service
        if (props.mapLayerSourceToEdit !== undefined) {
          const vp = props.activeViewport;
          void (async () => {
            if (isSettingsStorageAvailable && vp) {
              if (!(await MapLayerSettingsService.replaceSourceInSettingsService(props.mapLayerSourceToEdit!, source, vp.iModel.contextId!, vp.iModel.iModelId!))) {
                const errorMessage = IModelApp.i18n.translate("mapLayers:Messages.MapLayerEditError", { layerName: props.mapLayerSourceToEdit?.name });
                IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
                return;
              }

            }
          })();
          return;
        }
      }

      setLayerAttachPending(true);

      void (async () => {
        // Code below is executed in the an async manner but
        // I don't necessarily  want to mark the handler as async
        // so Im wrapping it un in a void wrapper.
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

  }, [mapUrl, mapName, mapType, userName, password, props.mapLayerSourceToEdit, props.activeViewport, isSettingsStorageAvailable, doAttach]);

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

  React.useEffect(() => {
    const handleEsriOAuth2Callback = (success: boolean, serviceUrl: string) => {
      if (success) {
        setEsriOAuth2Succeeded(true);
        setShowEsriOauth2Popup(false);
        console.log(`MapUrlDialog handled EsriOAuth2Callback event. SUCCESS serviceUrl=${serviceUrl}`);
        setLayerAttachPending(false);
        // try adding the layer the same way if user clicked the ok button
        handleOk();
      } else {
        console.log(`handleEsriOAuth2Callback handled EsriOAuth2Callback event. ERROR`);
      }

    };
    EsriOAuth2.onEsriOAuth2Callback.addListener(handleEsriOAuth2Callback);

    return () => {
      EsriOAuth2.onEsriOAuth2Callback.removeListener(handleEsriOAuth2Callback);
    };
  }, [handleOk]);

  const [showEsriOauth2Popup, setShowEsriOauth2Popup] = React.useState(false);

  const handleEsriOAuth2PopupClose = React.useCallback(() => {
    console.log("MapUrlDialog: PopupDialog was closed");
    setShowEsriOauth2Popup(false);
    setLayerAuthPending(false);
    setEsriOAuth2Succeeded(false);  // indicates there was a failed attempt

  }, []);

  function renderWarningMessage(): React.ReactNode {
    let node: React.ReactNode;
    let warningMessage2: string|undefined;

    // Get the proper warning message
    if (showEsriOauth2Popup) {
      warningMessage2 = "Waiting for external login process to complete...";
    } else if (esriOAuth2Succeeded === false) {
      warningMessage2 = "External login process failed.";
    } else if (invalidCredentialsProvided) {
      warningMessage2 = invalidCredentialsLabel;
    } else if (serverRequireCredentials && (!userName || !password))  {
      warningMessage2 = missingCredentialsLabel;
    }

    // Sometimes we want to add an extra node, such as a button
    let extraNode: React.ReactNode;
    if (esriOAuth2Succeeded === false) {
      extraNode = <div>
        <Button onClick={handleArcGisLogin}>Try Again</Button>
      </div>;
    }

    if (warningMessage2 !== undefined) {
      return(
        <div className="map-layer-source-warnMessage">
          <Icon className="map-layer-source-warnMessage-icon" iconSpec="icon-status-warning" />
          <span className="map-layer-source-warnMessage-label">{warningMessage2}</span >
          {extraNode}
        </div>);
    } else {
      return (<span className="map-layer-source-placeholder">&nbsp;</span>);
    }
    return node;
  }

  useEsriOAuth2Popup(showEsriOauth2Popup, mapUrl, handleEsriOAuth2PopupClose);

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
            <Select
              className="map-manager-base-select"
              options={mapTypes}
              value={mapType}
              disabled={props.layerRequiringCredentials !== undefined || props.mapLayerSourceToEdit !== undefined} onChange={handleMapTypeSelection} />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input placeholder={nameInputPlaceHolder} onChange={onNameChange} value={mapName} disabled={props.layerRequiringCredentials !== undefined} />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input placeholder={urlInputPlaceHolder} onKeyPress={handleOnKeyDown} onChange={onUrlChange} disabled={props.mapLayerSourceToEdit !== undefined} value={mapUrl} />
            {serverRequireCredentials
             && (layerAuthMethod === MapLayerAuthType.Basic ||  layerAuthMethod === MapLayerAuthType.EsriToken)
             && props.mapLayerSourceToEdit === undefined &&
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
            {isSettingsStorageAvailable && <div title={settingsStorageDisabled ? noSaveSettingsWarning : ""}>
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
        {renderWarningMessage()}

        {/* Progress bar */}
        {(layerAttachPending || layerAuthPending) &&
          <div className="map-layer-source-progressBar">
            <ProgressBar indeterminate />
          </div>
        }
      </Dialog>
    </div >
  );
}
