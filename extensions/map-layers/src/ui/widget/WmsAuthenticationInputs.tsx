/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Icon, Input, Select } from "@bentley/ui-core";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MAP_TYPES } from "./MapUrlDialog";

/** @alpha */
export interface WmsAutenticationInputProps {
  mapType: string;
  wmsServerUrl: string;
  setSettingsStorageRadio: Function;
  setWmsServerUsername: Function;
  setWmsServerPassword: Function;
  setSkipSettingsStorage: Function;
}

/** @alpha */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function WmsAuthenticationInput(props: WmsAutenticationInputProps) {

  const warningProtocolLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.WarningProtocolLabel");
  const authenticationLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.Authentication");
  const noAuthLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.NoAuth");
  const basicLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.Basic");
  const passwordLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.Password");
  const usernameLabel = MapLayersUiItemsProvider.i18n.translate("mapLayers:WmsAuthenticationInputs.Username");

  const [authenticationType, setAuthenticationType] = React.useState(noAuthLabel);
  const [invalidProtocol, setInvalidProtocol] = React.useState(true);
  const authenticationTypes = [noAuthLabel, basicLabel];

  const setWmsServerUsername = props.setWmsServerUsername;
  const setWmsServerPassword = props.setWmsServerPassword;
  const setSettingsStorageRadio = props.setSettingsStorageRadio;
  const wmsServerUrl = props.wmsServerUrl;
  const setSkipSettingsStorage = props.setSkipSettingsStorage;

  const onWmsUsernameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setWmsServerUsername(event.target.value);
  }, [setWmsServerUsername]);

  const onWmsPasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setWmsServerPassword(event.target.value);
  }, [setWmsServerPassword]);

  const handleAuthenticationTypeSelection = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    if (e.target.value === noAuthLabel) {
      setWmsServerPassword("");
      setWmsServerUsername("");
      setSettingsStorageRadio("Project");
    } else {
      setSettingsStorageRadio("");
    }
    setAuthenticationType(e.target.value);
  }, [setAuthenticationType, setWmsServerPassword,
    setWmsServerUsername, setSettingsStorageRadio, noAuthLabel]);

  React.useEffect(() => {
    try {
      const url = new URL(wmsServerUrl);
      if (url.protocol === "https:" ||
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1") {
        setInvalidProtocol(false);
        if (authenticationType !== noAuthLabel)
          setSkipSettingsStorage(true);
        else
          setSkipSettingsStorage(false);
        return;
      }
    } catch (_) {
    }
    setAuthenticationType(noAuthLabel);
    setWmsServerPassword("");
    setWmsServerUsername("");
    setInvalidProtocol(true);
    return (() => {
      setSkipSettingsStorage(false);
    });
  }, [invalidProtocol, setSkipSettingsStorage,
    authenticationType, setWmsServerPassword,
    setWmsServerUsername, wmsServerUrl, noAuthLabel]);

  return (
    <>
      <>
        <span className="map-layer-source-label">{authenticationLabel}
          {invalidProtocol &&
            <span className="map-layer-warning-icon" title={warningProtocolLabel}>
              <Icon iconSpec="icon-info-hollow" />
            </span>}
        </span>
        <Select disabled={invalidProtocol && props.mapType === MAP_TYPES.wms}
          className="map-manager-base-select"
          options={authenticationTypes}
          value={authenticationType}
          onChange={handleAuthenticationTypeSelection} />
      </>
      {authenticationType !== noAuthLabel &&
        <>
          <span className="map-layer-source-label">{usernameLabel}</span>
          <Input placeholder="Username" onChange={onWmsUsernameChange} />
          <span className="map-layer-source-label">{passwordLabel}</span>
          <Input placeholder="Password" type="password" onChange={onWmsPasswordChange} />
        </>
      }
    </>
  );
}
