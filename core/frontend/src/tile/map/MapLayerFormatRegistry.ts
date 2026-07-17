/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert, expectDefined, Logger } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapLayerKey, MapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { ImageryMapLayerTreeReference, internalMapLayerImageryFormats, MapLayerAccessClient, MapLayerAuthenticationInfo, MapLayerImageryProvider, MapLayerSource, MapLayerSourceStatus, MapLayerTileTreeReference, tryGetOrigin } from "../internal";
const loggerCategory = "ArcGISFeatureProvider";

/**
 * Class representing a map-layer format.
 * Each format has it's unique 'formatId' string, used to uniquely identify a format in the [[MapLayerFormatRegistry]].
 * When creating an [[ImageMapLayerSettings]] object, a format needs to be specified this 'formatId'.
 * The MapLayerFormat object can later be used to validate a source, or create a provider.
 *
 * Subclasses should override formatId, [[MapLayerFormat.createImageryProvider]], and [[MapLayerFormat.createMapLayerTree]].
 * @public
 */
export class MapLayerFormat {
  public static formatId: string;

  /** Register the current format in the [[MapLayerFormatRegistry]]. */
  public static register() { IModelApp.mapLayerFormatRegistry.register(this); }

  /**
   * Allow a source of a specific format to be validated before being attached as a map-layer.
   * @param _url The URL of the source.
   * @param _userName The username to access the source if needed.
   * @param _password The password to access the source if needed.
   * @param _ignoreCache Flag to skip cache lookup (i.e. force a new server request).
   * @returns Validation Status. If successful, a list of available sub-layers may also be returned.
   */
  public static async validateSource(_url: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _accesKey?: MapLayerKey): Promise<MapLayerSourceValidation> { return { status: MapLayerSourceStatus.Valid }; }

  /** Allow a source object to be validated before being attached as a map-layer.
    * @beta
  */
  public static async validate(args: ValidateSourceArgs): Promise<MapLayerSourceValidation> {
    return this.validateSource(args.source.url, args.source.userName, args.source.password, args.ignoreCache);
  }

  /**
   * Create a [[MapLayerImageryProvider]] that will be used to feed data in a map-layer tile tree.
   * @param _settings The map layer settings to be applied to the imagery provider.
   * @returns Returns the new imagery provider.
   * @beta
   */
  public static createImageryProvider(_settings: MapLayerSettings): MapLayerImageryProvider | undefined { assert(false); }

  /**
   * Creates a MapLayerTileTreeReference for this map layer format.
   * @param _layerSettings Map layer settings that are applied to the MapLayerTileTreeReference.
   * @param _layerIndex The index of the associated map layer.
   * @param _iModel The iModel containing the MapLayerTileTreeReference.
   * @returns Returns the new tile tree reference.
   * @beta
   */
  public static createMapLayerTree(_layerSettings: MapLayerSettings, _layerIndex: number, _iModel: IModelConnection): MapLayerTileTreeReference | undefined {
    assert(false);
    return undefined;
  }

}

/** Options for validating sources
 * @beta
 */
export interface ValidateSourceArgs {
  source: MapLayerSource;
  /** Disable cache lookup during validate process  */
  ignoreCache?: boolean;
}

/**
 * The type of a map layer format.
 * @public
 */
export type MapLayerFormatType = typeof MapLayerFormat;

/** Error thrown when an NTLM or Negotiate http 401 challenge could not be answered because the request
 * URL's origin is not listed in [[MapLayerFormatRegistry.trustedCredentialsOrigins]]
 * (see [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]).
 * Thrown by the static map-layer utilities (e.g. capabilities / service-metadata fetches) that have no
 * provider instance on which to report the blocked origin; callers convert it to
 * [[MapLayerImageryProviderStatus.UntrustedOrigin]] (provider initialization) or
 * [[MapLayerSourceStatus.UntrustedOrigin]] (source validation).
 * @internal
 */
export class MapLayerUntrustedOriginError extends Error {
  /** The URL of the request whose authentication challenge was left unanswered. */
  public readonly url: string;

  constructor(url: string) {
    super(`Authentication blocked: origin of '${url}' is not listed in MapLayerFormatRegistry.trustedCredentialsOrigins`);
    this.url = url;
  }
}

/** @public */
export interface MapLayerSourceValidation {
  status: MapLayerSourceStatus;
  subLayers?: MapSubLayerProps[];

  /** @beta */
  authInfo?: MapLayerAuthenticationInfo;
}

/**
 * Options supplied at startup via [[IModelAppOptions.mapLayerOptions]] to specify access keys for various map layer formats.
 * 'BingMaps' must have it's key value set to 'key'
 * 'MapboxImagery' must have it's key value set to 'access_token'
 * Some format-specific options, including `BingMaps`, are retained for compatibility.
 *
 * @public
 */
export interface MapLayerOptions {
  /** Access key for Azure Maps in the format `{ key: "subscription-key", value: "your-azure-maps-key" }`. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AzureMaps?: MapLayerKey;
  /** Access key for Mapbox in the format `{ key: "access_token", value: "your-mapbox-key" }`. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MapboxImagery?: MapLayerKey;
  /** Access key for Bing Maps in the format `{ key: "key", value: "your-bing-maps-key" }`.
   * @deprecated in 5.11.0 - will not be removed until after 2027-07-03. All Bing Maps APIs are deprecated. Supply custom providers via
   * [[IModelAppOptions.geospatialProviders]].
   * For basemap imagery, use `@itwin/map-layers-formats`.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  BingMaps?: MapLayerKey;
  /** Access keys for additional map layer formats. */
  [format: string]: MapLayerKey | undefined;
}

/** @internal */
export interface MapLayerFormatEntry {
  type: MapLayerFormatType;
  accessClient?: MapLayerAccessClient;
}

/**
 * A registry of MapLayerFormats identified by their unique format IDs. The registry can be accessed via [[IModelApp.mapLayerFormatRegistry]].
 * @public
 */
export class MapLayerFormatRegistry {
  private _configOptions: MapLayerOptions;
  private _trustedCredentialsOrigins: string[] = [];

  /** Opt-in enforcement of origin restrictions on map-layer credentials.
   * When enabled, map layer providers:
   * - attach the basic-auth credentials stored in the layer settings only to requests targeting the origin
   *   of the layer's settings URL or an origin listed in [[trustedCredentialsOrigins]];
   * - retry a request with browser credentials included (i.e. SSO / Windows Authentication) after an NTLM
   *   or Negotiate http 401 challenge only for origins explicitly listed in [[trustedCredentialsOrigins]]
   *   (the settings-URL origin is NOT implicitly trusted for SSO, since map-layer URLs may originate from
   *   untrusted user input while SSO shares the user's ambient identity).
   * Default is false, preserving the legacy behavior of sending credentials to any request URL.
   * @beta
   */
  public restrictCredentialsToTrustedOrigins = false;

  constructor(opts?: MapLayerOptions) {
    this._configOptions = opts ?? {};
    internalMapLayerImageryFormats.forEach((format) => this.register(format));
  }

  /** Origins (e.g. "https://tiles.example.com") to which map layer providers may send credentials —
   * both the basic-auth credentials stored in the layer settings and browser credentials for
   * SSO (i.e. Windows Authentication) retries after an NTLM or Negotiate http 401 challenge.
   * Only enforced when [[restrictCredentialsToTrustedOrigins]] is enabled.
   * For basic-auth, the origin of each map layer's settings URL is always implicitly trusted; for SSO,
   * origins must be explicitly listed here.
   * Entries are normalized to their origin (scheme + host + port); invalid entries are ignored and logged.
   * @beta
   */
  public get trustedCredentialsOrigins(): ReadonlyArray<string> {
    return this._trustedCredentialsOrigins;
  }

  public set trustedCredentialsOrigins(origins: ReadonlyArray<string>) {
    const normalized: string[] = [];
    for (const entry of origins) {
      const origin = tryGetOrigin(entry);
      if (origin !== undefined)
        normalized.push(origin);
      else
        Logger.logWarning(loggerCategory, `trustedCredentialsOrigins: ignoring invalid origin '${entry}'`);
    }
    this._trustedCredentialsOrigins = normalized;
  }

  /** Returns true if a request to the given URL may be retried with browser credentials included
   * (i.e. SSO / Windows Authentication) after an NTLM or Negotiate http 401 challenge.
   * Always true unless [[restrictCredentialsToTrustedOrigins]] is enabled (opt-in).
   * When enabled, the URL's origin must be explicitly listed in [[trustedCredentialsOrigins]];
   * unlike basic-auth, the settings-URL origin is NOT implicitly trusted because SSO shares the user's
   * ambient identity, and map-layer URLs may originate from untrusted user input.
   * @internal
   */
  public isSsoAllowed(url: string): boolean {
    if (!this.restrictCredentialsToTrustedOrigins)
      return true;

    const origin = tryGetOrigin(url);

    // Entries are normalized to their origin by the [[trustedCredentialsOrigins]] setter.
    return origin !== undefined && this._trustedCredentialsOrigins.includes(origin);
  }

  /** Origins for which a "credentials sent to untrusted origin" warning was already logged;
   * used to log the discovery warning only once per origin.
   */
  private readonly _untrustedUseLogged = new Set<string>();

  /** Logs a warning (once per origin) when credentials are sent to an origin that would be blocked
   * if [[restrictCredentialsToTrustedOrigins]] were enabled.
   * Helps applications discover the origins they need to whitelist before opting in to the restriction.
   * @internal
   */
  public logUntrustedOriginUse(url: string): void {
    if (this.restrictCredentialsToTrustedOrigins)
      return;   // restriction active; nothing to preview

    const origin = tryGetOrigin(url) ?? url;

    if (this._untrustedUseLogged.has(origin) || this._trustedCredentialsOrigins.includes(origin))
      return;

    this._untrustedUseLogged.add(origin);
    Logger.logWarning(loggerCategory, `Credentials sent to origin '${origin}' which is not in MapLayerFormatRegistry.trustedCredentialsOrigins; `
      + "this request would be blocked if restrictCredentialsToTrustedOrigins were enabled.");
  }

  private _formats = new Map<string, MapLayerFormatEntry>();

  public isRegistered(formatId: string) { return this._formats.get(formatId) !== undefined; }

  public register(formatClass: MapLayerFormatType) {
    if (formatClass.formatId.length === 0)
      return; // must be an abstract class, ignore it

    this._formats.set(formatClass.formatId, { type: formatClass });
  }

  /** @beta */
  public setAccessClient(formatId: string, accessClient: MapLayerAccessClient): boolean {
    const entry = this._formats.get(formatId);
    if (entry !== undefined) {
      entry.accessClient = accessClient;
      return true;
    }
    return false;
  }

  /** @beta */
  public getAccessClient(formatId: string): MapLayerAccessClient | undefined {
    if (formatId.length === 0)
      return undefined;

    return this._formats.get(formatId)?.accessClient;
  }

  public get configOptions(): MapLayerOptions {
    return this._configOptions;
  }

  /** @internal */
  public createImageryMapLayerTree(layerSettings: ImageMapLayerSettings, layerIndex: number, iModel: IModelConnection): ImageryMapLayerTreeReference | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    if (format === undefined) {
      Logger.logError(loggerCategory, `Could not find format '${layerSettings.formatId}' in registry`);
      return undefined;
    }
    return format.createMapLayerTree(layerSettings, layerIndex, iModel);
  }

  /**
   * Returns a [[MapLayerImageryProvider]] based on the provided [[ImageMapLayerSettings]] object.
   * @internal
   */
  public createImageryProvider(layerSettings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    if (this._configOptions[layerSettings.formatId] !== undefined) {
      const keyValuePair = expectDefined(this._configOptions[layerSettings.formatId]);
      const key: MapLayerKey = { key: keyValuePair.key, value: keyValuePair.value };
      layerSettings = layerSettings.clone({ accessKey: key });
    }
    return (format === undefined) ? undefined : format.createImageryProvider(layerSettings);
  }

  /** @beta*/
  public async validateSource(opts: ValidateSourceArgs): Promise<MapLayerSourceValidation>;

  public async validateSource(formatId: string, url: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation>;

  /** @internal*/
  public async validateSource(formatIdOrArgs: string|ValidateSourceArgs, url?: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    let format: typeof MapLayerFormat | undefined;
    let args: ValidateSourceArgs | undefined;

    if (typeof formatIdOrArgs == "string" && url !== undefined) {
      const formatId = formatIdOrArgs;
      const entry = this._formats.get(formatId);
      format = entry?.type;
      if (format !== undefined) {
        const source =  MapLayerSource.fromJSON({name: "", formatId, url});
        if (source !== undefined) {
          args = {source, ignoreCache};
          source.userName = userName;
          source.password = password;
        }

      }
    } else if (typeof formatIdOrArgs !== "string") {
      const entry = this._formats.get(formatIdOrArgs.source.formatId);
      format = entry?.type;
      args = formatIdOrArgs;
    }

    if (!args || !format)
      return { status: MapLayerSourceStatus.InvalidFormat };

    return format.validate(args);
  }
}

