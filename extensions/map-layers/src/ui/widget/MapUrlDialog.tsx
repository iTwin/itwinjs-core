/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { DialogButtonType, SpecialKey } from "@itwin/appui-abstract";
import { ModalDialogManager } from "@itwin/appui-react";
import { Button, Input, LabeledInput, ProgressLinear, Radio } from "@itwin/itwinui-react";
import { ImageMapLayerProps } from "@itwin/core-common";
import { IModelApp, MapLayerAccessClient, MapLayerImageryProviderStatus, MapLayerSource,
  MapLayerSourceStatus, MapLayerSourceValidation, NotifyMessageDetails, OutputMessagePriority, ScreenViewport,
} from "@itwin/core-frontend";
import { Dialog, Icon, useCrossOriginPopup } from "@itwin/core-react";
import * as React from "react";
import { MapLayerPreferences } from "../../MapLayerPreferences";
import { MapLayersUI } from "../../mapLayers";
import { MapTypesOptions } from "../Interfaces";
import "./MapUrlDialog.scss";
import { BeEvent, Guid } from "@itwin/core-bentley";
import { SelectMapFormat } from "./SelectMapFormat";

export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
  arcGisFeature: "ArcGISFeature",
};

interface MapUrlDialogProps {
  activeViewport?: ScreenViewport;
  isOverlay: boolean;
  onOkResult: () => void;
  onCancelResult?: () => void;
  mapTypesOptions?: MapTypesOptions;

  // An optional layer definition can be provide to enable the edit mode
  layerRequiringCredentials?: ImageMapLayerProps;

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

  const [dialogTitle] = React.useState(MapLayersUI.localization.getLocalizedString(props.layerRequiringCredentials || props.mapLayerSourceToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer"));
  const [typeLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Name"));
  const [nameInputPlaceHolder] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.NameInputPlaceHolder"));
  const [urlLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.URL"));
  const [urlInputPlaceHolder] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.UrlInputPlaceHolder"));
  const [iTwinSettingsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.StoreOnITwinSettings"));
  const [modelSettingsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.StoreOnModelSettings"));
  const [missingCredentialsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.MissingCredentials"));
  const [invalidCredentialsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.InvalidCredentials"));
  const [externalLoginTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLogin"));
  const [externalLoginFailedMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginFailed"));
  const [externalLoginSucceededMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginSucceeded"));
  const [externalLoginWaitingMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginWaiting"));
  const [externalLoginTryAgainLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginTryAgain"));
  const [serverRequireCredentials, setServerRequireCredentials] = React.useState(false);
  const [invalidCredentialsProvided, setInvalidCredentialsProvided] = React.useState(false);
  const [layerAttachPending, setLayerAttachPending] = React.useState(false);
  const [layerAuthPending, setLayerAuthPending] = React.useState(false);
  const [mapUrl, setMapUrl] = React.useState(getMapUrlFromProps());
  const [mapName, setMapName] = React.useState(getMapNameFromProps());
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.Password"));
  const [passwordRequiredLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.PasswordRequired"));
  const [userNameLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.Username"));
  const [userNameRequiredLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.UsernameRequired"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("iTwin");
  const [oauthProcessSucceeded, setOAuthProcessSucceeded] = React.useState<undefined|boolean>(undefined);
  const [showOauthPopup, setShowOauthPopup] = React.useState(false);
  const [externalLoginUrl, setExternalLoginUrl] = React.useState<string|undefined>();
  const [onOauthProcessEnd] = React.useState(new BeEvent());
  const [accessClient, setAccessClient] = React.useState<MapLayerAccessClient | undefined>();
  const [isAccessClientInitialized, setAccessClientInitialized] = React.useState(false);

  const [mapType, setMapType] = React.useState(getFormatFromProps() ?? "ArcGIS");

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [isSettingsStorageAvailable] = React.useState(MapLayersUI.iTwinConfig && props?.activeViewport?.iModel?.iTwinId);
  const [hasImodelContext] = React.useState (
    props?.activeViewport?.iModel?.iTwinId !== undefined
    && props.activeViewport.iModel.iTwinId !== Guid.empty
    && props?.activeViewport?.iModel?.iModelId !== undefined
    && props?.activeViewport.iModel.iModelId !== Guid.empty);

  // Even though the settings storage is available,
  // we don't always want to enable it in the UI.
  const [settingsStorageDisabled] = React.useState(!isSettingsStorageAvailable || props.mapLayerSourceToEdit !== undefined || props.layerRequiringCredentials !== undefined);

  const [layerRequiringCredentialsIdx] = React.useState((): number | undefined => {
    if (props.layerRequiringCredentials === undefined || !props.layerRequiringCredentials.name || !props.layerRequiringCredentials.url) {
      return undefined;
    }

    const indexInDisplayStyle = props.activeViewport?.displayStyle.findMapLayerIndexByNameAndSource(props.layerRequiringCredentials.name, props.layerRequiringCredentials.url, isOverlay);
    if (indexInDisplayStyle === undefined || indexInDisplayStyle < 0) {
      return undefined;
    } else {
      return indexInDisplayStyle;
    }
  });

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
    setShowOauthPopup(true);
    if (oauthProcessSucceeded === false) {
      setOAuthProcessSucceeded(undefined);
    }

  }, [oauthProcessSucceeded]);

  // return true if authorization is needed
  const updateAuthState = React.useCallback(async (source: MapLayerSource, sourceValidation: MapLayerSourceValidation)  => {
    const sourceRequireAuth = (sourceValidation.status === MapLayerSourceStatus.RequireAuth);
    const invalidCredentials = (sourceValidation.status === MapLayerSourceStatus.InvalidCredentials);
    if (sourceRequireAuth) {
      const settings = source.toLayerSettings();

      if (accessClient !== undefined && accessClient.getTokenServiceEndPoint !== undefined && settings !== undefined) {
        try {
          const tokenEndpoint = await accessClient.getTokenServiceEndPoint(settings.url);
          if (tokenEndpoint !== undefined) {
            const loginUrl = tokenEndpoint.getLoginUrl();
            setExternalLoginUrl(loginUrl);
          }

        } catch (_error){

        }
      }

    }
    setServerRequireCredentials(sourceRequireAuth || invalidCredentials);
    if (invalidCredentials) {
      setInvalidCredentialsProvided(true);
    } else if (invalidCredentialsProvided) {
      setInvalidCredentialsProvided(false);  // flag reset
    }

    return sourceRequireAuth || invalidCredentials;
  }, [accessClient, invalidCredentialsProvided]);

  const updateAttachedLayer = React.useCallback(async (source: MapLayerSource, validation: MapLayerSourceValidation) => {
    const vp = props?.activeViewport;
    if (vp === undefined || source === undefined || layerRequiringCredentialsIdx === undefined)   {
      const error = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachMissingViewOrSource");
      const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      return true;
    }

    // Layer is already attached,
    vp.displayStyle.changeMapLayerProps({
      subLayers: validation.subLayers,
    }, layerRequiringCredentialsIdx, isOverlay);
    vp.displayStyle.changeMapLayerCredentials(layerRequiringCredentialsIdx, isOverlay, source.userName, source.password);

    // Either initial attach/initialize failed or the layer failed to load at least one tile
    // because of an invalid token; in both cases tile tree needs to be fully reset
    const provider = vp.getMapLayerImageryProvider(layerRequiringCredentialsIdx, isOverlay);
    provider?.resetStatus();
    vp.resetMapLayer(layerRequiringCredentialsIdx, isOverlay);
    vp.invalidateRenderPlan();

    // This handler will close the layer source handler, and therefore the MapUrl dialog.
    // don't call it if the dialog needs to remains open.
    onOkResult();

    return true;
  }, [isOverlay, layerRequiringCredentialsIdx, onOkResult, props.activeViewport]);

  // Returns true if no further input is needed from end-user.
  const doAttach = React.useCallback(async (source: MapLayerSource, validation: MapLayerSourceValidation): Promise<boolean> => {
    const vp = props?.activeViewport;
    if (vp === undefined || source === undefined) {
      const error = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachMissingViewOrSource");
      const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      return true;
    }

    // Update service settings if storage is available and we are not prompting user for credentials
    if (!settingsStorageDisabled && !props.layerRequiringCredentials) {
    	const storeOnIModel = (hasImodelContext ? "Model" === settingsStorage : undefined);
      if (vp.iModel.iTwinId && !(await MapLayerPreferences.storeSource(source, vp.iModel.iTwinId, vp.iModel.iModelId, storeOnIModel))) {
        const msgError = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerPreferencesStoreFailed");
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msgError));
	  }
    }
    const settings = source.toLayerSettings(validation.subLayers);
    if (settings) {
      vp.displayStyle.attachMapLayer({settings, isOverlay});

      const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttached", { sourceName: source.name, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    } else {
      const msgError = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerLayerSettingsConversionError");
      const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.MapLayerAttachError", { error: msgError, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
    }

    vp.invalidateRenderPlan();

    // This handler will close the layer source handler, and therefore the MapUrl dialog.
    // don't call it if the dialog needs to remains open.
    onOkResult();

    return true;
  }, [hasImodelContext, isOverlay, onOkResult, props?.activeViewport, props.layerRequiringCredentials, settingsStorage, settingsStorageDisabled]);

  // Validate the layer source and attempt to attach (or update) the layer.
  // Returns true if no further input is needed from end-user (i.e. close the dialog)
  const attemptAttachSource = React.useCallback(async (source: MapLayerSource): Promise<boolean> => {
    try {
      const validation = await source.validateSource(true);

      if (validation.status === MapLayerSourceStatus.Valid) {
        if (layerRequiringCredentialsIdx === undefined ) {
          return await doAttach(source, validation);
        } else {
          return await updateAttachedLayer(source, validation);
        }
      } else {
        const authNeeded = await updateAuthState(source, validation);
        if (authNeeded) {
          return false;
        } else {
          const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ValidationError");
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} ${source.url}`));
          return true;
        }
      }
      return false;
    } catch (error) {
      const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      return true;
    }

  }, [updateAuthState, doAttach, layerRequiringCredentialsIdx, updateAttachedLayer]);

  const onNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapName(event.target.value);
  }, [setMapName]);

  const onRadioChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsStorageRadio(event.target.value);
  }, [setSettingsStorageRadio]);

  const onUrlChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(event.target.value);
  }, [setMapUrl]);

  const createSource = React.useCallback(() => {
    let source: MapLayerSource | undefined;
    if (mapUrl && mapName) {
      source = MapLayerSource.fromJSON({
        url: mapUrl,
        name: mapName,
        formatId: mapType});

      // Set credentials separately since they are not part of JSON
      if (source) {
        source.userName = userName||undefined;  // When there is no value, empty string is always returned, in this case force it to undefined,
        source.password = password||undefined;
      }

    }
    return source;
  }, [mapName, mapType, mapUrl, password, userName]);

  const handleOk = React.useCallback(() => {
    const source = createSource();
    if (source === undefined || props.mapLayerSourceToEdit) {

      ModalDialogManager.closeDialog();
      onOkResult();

      if (source === undefined) {
        // Close the dialog and inform end user something went wrong.
        const msgError = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerLayerSourceCreationFailed");
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error: msgError, sourceUrl: mapUrl });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      // Simply change the source definition in the setting service
      if (props.mapLayerSourceToEdit !== undefined) {
        const vp = props.activeViewport;
        void (async () => {
          if (isSettingsStorageAvailable && vp?.iModel?.iTwinId) {
            try {
              await MapLayerPreferences.replaceSource(props.mapLayerSourceToEdit!, source, vp.iModel.iTwinId, vp?.iModel.iModelId);
            } catch (err: any) {
              const errorMessage = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerEditError", { layerName: props.mapLayerSourceToEdit?.name });
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
              return;
            }
          }
        })();
        return;
      }
    }

    setLayerAttachPending(true);

    // Attach source asynchronously.
    void (async () => {
      try {
        const closeDialog = await attemptAttachSource(source);
        if (isMounted.current) {
          setLayerAttachPending(false);
        }

        // In theory the modal dialog should always get closed by the parent
        // AttachLayerPanel's 'onOkResult' handler.  We close it here just in case.
        if (closeDialog) {
          ModalDialogManager.closeDialog();
          onOkResult();
        }
      } catch (_error) {
        onOkResult();
        ModalDialogManager.closeDialog();
      }
    })();

  }, [createSource, props.mapLayerSourceToEdit, props.activeViewport, onOkResult, mapUrl, isSettingsStorageAvailable, attemptAttachSource]);

  React.useEffect(() => {
    const handleOAuthProcessEnd = (success: boolean, _state: any ) => {
      onOauthProcessEnd.raiseEvent(success, _state);
    };

    // Currently only arcgis support AccessClient

    const ac = IModelApp.mapLayerFormatRegistry.getAccessClient(MAP_TYPES.arcGis);
    if (ac?.onOAuthProcessEnd) {
      setAccessClient(ac);   // cache it, so we dont need to make another lookup;
      ac.onOAuthProcessEnd.addListener(handleOAuthProcessEnd);
    }
    setAccessClientInitialized(true);
    return () => {
      if (ac?.onOAuthProcessEnd) {
        ac.onOAuthProcessEnd.removeListener(handleOAuthProcessEnd);
      }

      setAccessClient(undefined);
      setAccessClientInitialized(false);
    };
  }, [mapType, onOauthProcessEnd, setAccessClient]);

  // After a map type change, make sure the different Oauth states are reset.
  React.useEffect(() => {
    // Reset few states
    setServerRequireCredentials(false);
    setInvalidCredentialsProvided(false);
    setShowOauthPopup(false);
    setOAuthProcessSucceeded(undefined);
    setExternalLoginUrl(undefined);

  }, [mapType]);

  // The first time the dialog is loaded and we already know the layer requires auth. (i.e ImageryProvider already made an attempt)
  // makes a request to discover the authentification types and adjust UI accordingly (i.e. username/password fields, Oauth popup)
  // Without this effect, user would have to manually click the 'OK' button in order to trigger the layer connection.
  React.useEffect(() => {
    // Attach source asynchronously.
    void (async () => {
      if (isAccessClientInitialized && props.layerRequiringCredentials?.url !== undefined && props.layerRequiringCredentials?.name !== undefined) {
        try {
          const source = MapLayerSource.fromJSON({
            url: props.layerRequiringCredentials.url,
            name: props.layerRequiringCredentials.name,
            formatId: props.layerRequiringCredentials.formatId});

          if (source !== undefined) {
            setLayerAttachPending(true);
            const validation = await source.validateSource(true);
            if (isMounted.current) {
              setLayerAttachPending(false);
            }
            await updateAuthState(source, validation);
          }
        } catch (_error) {}
      }
    })();

  }, [isAccessClientInitialized,
    props.layerRequiringCredentials?.formatId,
    props.layerRequiringCredentials?.name,
    props.layerRequiringCredentials?.url,
    updateAuthState]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const readyToSave = React.useCallback(() => {
    const credentialsSet = !!userName && !!password;
    return (!!mapUrl && !!mapName)
      && !layerAttachPending
      && (!serverRequireCredentials || credentialsSet)
      && !invalidCredentialsProvided
      && (externalLoginUrl === undefined || (externalLoginUrl !== undefined && oauthProcessSucceeded));
  }, [userName, password, mapUrl, mapName, serverRequireCredentials, layerAttachPending, invalidCredentialsProvided, externalLoginUrl, oauthProcessSucceeded]);

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

  // onOauthProcessEnd events handler
  React.useEffect(() => {
    const handleOauthProcess = (success: boolean, _state: any ) => {
      setLayerAuthPending(false);
      if (success) {
        setOAuthProcessSucceeded(true);
        setShowOauthPopup(false);
        setLayerAttachPending(false);
        handleOk(); // Add the layer the same way the user would do by clicking 'ok'
      } else {
        setShowOauthPopup(false);
        setLayerAttachPending(false);
        setOAuthProcessSucceeded(false);
      }
    };

    onOauthProcessEnd.addListener(handleOauthProcess);
    return () => {
      onOauthProcessEnd.removeListener(handleOauthProcess);
    };
  }, [handleOk, onOauthProcessEnd]);

  //
  // Monitors authentication method changes
  React.useEffect(() => {

    if (serverRequireCredentials && oauthProcessSucceeded === undefined && externalLoginUrl !== undefined) {
      handleArcGisLogin();
    }
  }, [oauthProcessSucceeded, externalLoginUrl, handleArcGisLogin, serverRequireCredentials]);

  // Monitors Oauth2 popup was closed
  const handleOAuthPopupClose = React.useCallback(() => {
    setShowOauthPopup(false);
    setLayerAuthPending(false);
    if (oauthProcessSucceeded === undefined)
      setOAuthProcessSucceeded(false);  // indicates there was a failed attempt
  }, [oauthProcessSucceeded]);

  // Utility function to get warning message section
  function renderWarningMessage(): React.ReactNode {
    let node: React.ReactNode;
    let warningMessage: string|undefined;

    // Get the proper warning message
    if (showOauthPopup) {
      warningMessage = externalLoginWaitingMsg;
    } else if (oauthProcessSucceeded === false) {
      warningMessage = externalLoginFailedMsg;
    } else if (oauthProcessSucceeded === true) {
      warningMessage = externalLoginSucceededMsg;
    }else if (invalidCredentialsProvided) {
      warningMessage = invalidCredentialsLabel;
    } else if (serverRequireCredentials && (!userName || !password))  {
      warningMessage = missingCredentialsLabel;
    }

    // Sometimes we want to add an extra node, such as a button
    let extraNode: React.ReactNode;
    if (oauthProcessSucceeded === false) {
      extraNode = <div>
        <Button onClick={handleArcGisLogin}>{externalLoginTryAgainLabel}</Button>
      </div>;
    }

    if (warningMessage !== undefined) {
      return(
        <div className="map-layer-source-warnMessage">
          <Icon className="map-layer-source-warnMessage-icon" iconSpec="icon-status-warning" />
          <span className="map-layer-source-warnMessage-label">{warningMessage}</span >
          {extraNode}
        </div>);
    } else {
      return (<span className="map-layer-source-placeholder">&nbsp;</span>);
    }
    return node;
  }

  // Use a hook to display the popup.
  // The display of the popup is controlled by the 'showOauthPopup' state variable.
  useCrossOriginPopup(showOauthPopup, externalLoginUrl, externalLoginTitle, 450, 450, handleOAuthPopupClose);
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
        titleStyle={{paddingLeft: "10px"}}
        footerStyle={{paddingBottom: "10px", paddingRight: "10px"}}
        trapFocus={false}
      >
        <div className="map-layer-url-dialog-content">
          <div className="map-layer-source-url">
            <span className="map-layer-source-label">{typeLabel}</span>
            <SelectMapFormat
              value={mapType}
              disabled={props.layerRequiringCredentials !== undefined || props.mapLayerSourceToEdit !== undefined || layerAttachPending || layerAuthPending}
              onChange={setMapType}
              mapTypesOptions={mapTypesOptions}
            />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input className="map-layer-source-input"  placeholder={nameInputPlaceHolder} onChange={onNameChange} value={mapName} disabled={props.layerRequiringCredentials !== undefined || layerAttachPending || layerAuthPending} />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input className="map-layer-source-input" placeholder={urlInputPlaceHolder} onKeyPress={handleOnKeyDown} onChange={onUrlChange} disabled={props.mapLayerSourceToEdit !== undefined || layerAttachPending || layerAuthPending} value={mapUrl} />
            {serverRequireCredentials
             && externalLoginUrl === undefined  // external login is handled in popup
             && props.mapLayerSourceToEdit === undefined &&
              <>
                <span className="map-layer-source-label">{userNameLabel}</span>
                <LabeledInput className="map-layer-source-input"
                  displayStyle="inline"
                  placeholder={serverRequireCredentials ? userNameRequiredLabel : userNameLabel}
                  status={(!userName && serverRequireCredentials) || invalidCredentialsProvided ? "warning" : undefined}
                  disabled={layerAttachPending || layerAuthPending}
                  onChange={onUsernameChange}
                  value={userName}
                  size="small" />

                <span className="map-layer-source-label">{passwordLabel}</span>
                <LabeledInput className="map-layer-source-input"

                  displayStyle="inline"
                  type="password" placeholder={serverRequireCredentials ? passwordRequiredLabel : passwordLabel}
                  status={(!password && serverRequireCredentials) || invalidCredentialsProvided? "warning" : undefined}
                  disabled={layerAttachPending || layerAuthPending}
                  onChange={onPasswordChange}
                  onKeyPress={handleOnKeyDown}
                  value={password}
                  size="small" />

              </>
            }

            {/* Store settings options, not shown when editing a layer */}
            {isSettingsStorageAvailable &&
            <div title={settingsStorageDisabled ? noSaveSettingsWarning : ""}>
              {hasImodelContext &&
              <div>
                <Radio disabled={settingsStorageDisabled}
                  name="settingsStorage" value="iTwin"
                  label={iTwinSettingsLabel} checked={settingsStorage === "iTwin"}
                  onChange={onRadioChange} />
                <Radio disabled={settingsStorageDisabled}
                  name="settingsStorage" value="Model"
                  label={modelSettingsLabel} checked={settingsStorage === "Model"}
                  onChange={onRadioChange} />
              </div> }
            </div>}
          </div>
        </div>

        {/* Warning message */}
        {renderWarningMessage()}

        {/* Progress bar */}
        {(layerAttachPending || layerAuthPending) &&
          <div className="map-layer-source-progressBar">
            <ProgressLinear indeterminate />
          </div>
        }
      </Dialog>
    </div >
  );
}
