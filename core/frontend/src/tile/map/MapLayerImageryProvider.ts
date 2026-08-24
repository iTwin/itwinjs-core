/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert, BeEvent } from "@itwin/core-bentley";
import { Cartographic, ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { Angle } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../NotificationManager";
import { ScreenViewport } from "../../Viewport";
import { appendQueryParams, applyAccessClientToRequest, GeographicTilingScheme, ImageryMapTile, ImageryMapTileTree, isAccessClientAuthFailure, MapCartoRectangle, MapFeatureInfoOptions, MapLayerAccessClient, MapLayerAccessTokenParams, MapLayerFeatureInfo, MapTilingScheme, QuadId, WebMercatorTilingScheme } from "../internal";
import { HitDetail } from "../../HitDetail";
import { headersIncludeAuthMethod, setBasicAuthorization, setRequestTimeout } from "../../request/utils";
import { DecorateContext } from "../../ViewContext";

/** @internal */
const tileImageSize = 256, untiledImageSize = 256;
const earthRadius = 6378137;
const doDebugToolTips = false;

/** Escapes HTML metacharacters so the text renders literally when assigned to `innerHTML`.
 * Use for any server- or user-supplied string that ends up in the map tooltip, which is rendered
 * as HTML by [[MapLayerTileTreeReference.getToolTip]].
 * @internal
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Returns the origin (scheme + host + port) of the given URL, or undefined if it cannot be parsed or does
 * not denote a distinct network origin.
 *
 * Only `http:` and `https:` URLs yield an origin. Every other scheme is rejected because opaque URLs
 * — `file:`, `data:`, `about:`, `blob:null`, and the custom protocols Electron hosts commonly register —
 * all serialize to the literal string `"null"`. Comparing those would make unrelated URLs look same-origin,
 * so a single trusted entry could unlock all of them. Callers use this for credential-trust decisions, and
 * returning `undefined` keeps those decisions fail-closed.
 * @internal
 */
export function tryGetOrigin(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  return (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.origin : undefined;
}

/** The status of the map layer imagery provider that lets you know if authentication is needed to request tiles.
 * @public
 */
export enum MapLayerImageryProviderStatus {
  Valid,
  RequireAuth,
  /** A request received an authentication challenge, but credentials were withheld because the request origin
   * is not trusted (see [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]).
   * The blocked origins are available via [[MapLayerImageryProvider.blockedOrigins]].
   * @beta
   */
  UntrustedOrigin,
}

/** @internal */
export interface WGS84Extent
{
  longitudeLeft: number;
  longitudeRight: number;
  latitudeTop: number;
  latitudeBottom: number;
}

/** Abstract class for map layer imagery providers.
 * Map layer imagery providers request and provide tile images and other data. Each map layer from a separate source needs its own imagery provider object.
 * @beta
 */
export abstract class MapLayerImageryProvider {
  protected _hasSuccessfullyFetchedTile = false;
  public readonly onStatusChanged = new BeEvent<(provider: MapLayerImageryProvider) => void>();

  /** @internal */
  private readonly _mercatorTilingScheme = new WebMercatorTilingScheme();

  /** @internal */
  private readonly _geographicTilingScheme = new GeographicTilingScheme();

  /** @internal */
  private _status = MapLayerImageryProviderStatus.Valid;

  /** @internal */
  private readonly _blockedOrigins = new Set<string>();

  /** Origins of requests for which credentials were withheld because they are not trusted
   * (see [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]).
   * Populated when [[status]] transitions to [[MapLayerImageryProviderStatus.UntrustedOrigin]];
   * [[onStatusChanged]] is raised again each time a new origin is added. Cleared by [[resetStatus]].
   * @beta
   */
  public get blockedOrigins(): ReadonlyArray<string> { return [...this._blockedOrigins]; }

  /** Origins for which a previous SSO handshake (i.e. Windows Authentication) succeeded.
   * Browser credentials are only included for subsequent requests targeting these origins,
   * so that a successful handshake with one host does not leak credentials to other hosts
   * this provider may contact.
   * @internal
   */
  private readonly _ssoSucceededOrigins = new Set<string>();

  /** Returns true if browser credentials should be included for the given URL because a previous
   * SSO handshake succeeded for its origin AND the origin is still allowed by the current policy
   * (see [[MapLayerFormatRegistry.isSsoAllowed]]). Re-checking the policy ensures a handshake recorded
   * while enforcement was disabled — or before an origin was removed from
   * [[MapLayerFormatRegistry.trustedCredentialsOrigins]] — does not keep latching credentials on.
   * @internal
   */
  protected includeUserCredentials(url: string): boolean {
    const origin = tryGetOrigin(url);
    return origin !== undefined && this._ssoSucceededOrigins.has(origin) && this.isSsoAllowed(url);
  }

  /** Records that an SSO handshake succeeded for the given URL's origin, so subsequent requests
   * to that origin include browser credentials without going through another 401 challenge.
   * @internal
   */
  protected recordSsoSucceeded(url: string): void {
    const origin = tryGetOrigin(url);
    if (origin !== undefined)
      this._ssoSucceededOrigins.add(origin);
  }

  /** @internal */
  protected readonly onFirstRequestCompleted = new BeEvent<() => void>();

  /** @internal */
  protected _firstRequestPromise: Promise<void>|undefined;

  /**
   * The status of the map layer imagery provider.
   * @public @preview
   */
  public get status() { return this._status; }

  /** Determine if this provider supports map feature info.
   * For example, this can be used to show the map feature info tool only when a provider is registered to support it.
   * @returns true if provider supports map feature info else return false.
   * @public
   */
  public get supportsMapFeatureInfo(): boolean { return false; }

  /** Reset the provider's status to [[MapLayerImageryProviderStatus.Valid]] and clear the list of
   * [[blockedOrigins]] accumulated while in the [[MapLayerImageryProviderStatus.UntrustedOrigin]] state.
   * Raises [[onStatusChanged]] if the status actually changes.
   * Typically called after the user has provided credentials or the application has updated
   * [[MapLayerFormatRegistry.trustedCredentialsOrigins]], so that subsequent requests are re-attempted.
   * @beta
   */
  public resetStatus() {
    this._blockedOrigins.clear();
    this.setStatus(MapLayerImageryProviderStatus.Valid);
  }

  /** @internal */
  public get tileSize(): number { return this._usesCachedTiles ? tileImageSize : untiledImageSize; }

  /** @internal */
  public get maximumScreenSize() { return 2 * this.tileSize; }

  public get minimumZoomLevel(): number { return this.defaultMinimumZoomLevel; }

  public get maximumZoomLevel(): number { return this.defaultMaximumZoomLevel; }

  /** @internal */
  public get usesCachedTiles() { return this._usesCachedTiles; }

  public get mutualExclusiveSubLayer(): boolean { return false; }

  /** @internal */
  public get useGeographicTilingScheme() { return false; }

  private _cartoRange?: MapCartoRectangle;

  /** Validates a cartographic range for NaN and infinite values.
   * @param range The cartographic range to validate.
   * @returns true if the range is valid, false otherwise.
   * @internal
   */
  private static isRangeValid(range: MapCartoRectangle | undefined): boolean {
    if (!range) {
      return false;
    }

    return !Number.isNaN(range.low.x) && !Number.isNaN(range.low.y) &&
           !Number.isNaN(range.high.x) && !Number.isNaN(range.high.y) &&
           Number.isFinite(range.low.x) && Number.isFinite(range.low.y) &&
           Number.isFinite(range.high.x) && Number.isFinite(range.high.y);
  }

  /** Gets or sets the cartographic range for this provider.
   * When setting, if the range is invalid (contains NaN or infinite values), it will be stored as undefined.
   * When getting, returns undefined if the range was set to an invalid value.
   */
  public get cartoRange(): MapCartoRectangle | undefined {
    return this._cartoRange;
  }

  public set cartoRange(range: MapCartoRectangle | undefined) {
    this._cartoRange = MapLayerImageryProvider.isRangeValid(range) ? range : undefined;
  }

  /**
   * This value is used internally for various computations, this should not get overriden.
   * @internal
   */
  protected readonly defaultMinimumZoomLevel = 0;

  /**
   * This value is used internally for various computations, this should not get overriden.
   * @internal
   */
  protected readonly defaultMaximumZoomLevel = 22;

  /** @internal */
  protected get _filterByCartoRange() { return true; }

  constructor(protected readonly _settings: ImageMapLayerSettings, protected _usesCachedTiles: boolean) {
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._geographicTilingScheme = new GeographicTilingScheme(2, 1, true);
  }

  /**
   * Initialize the provider by loading the first tile at its default maximum zoom level.
   * @beta
   */
  public async initialize(): Promise<void> {
    this.loadTile(0, 0, this.defaultMaximumZoomLevel).then((tileData: ImageSource | undefined) => { // eslint-disable-line @typescript-eslint/no-floating-promises
      if (tileData !== undefined)
        this._missingTileData = tileData.data as Uint8Array;
    });
  }

  public abstract constructUrl(row: number, column: number, zoomLevel: number): Promise<string>;

  public get tilingScheme(): MapTilingScheme { return this.useGeographicTilingScheme ? this._geographicTilingScheme : this._mercatorTilingScheme; }

  /** @deprecated in 5.0 - might be removed in next major version. Use [addAttributions] instead. */
  public addLogoCards(_cards: HTMLTableElement, _viewport: ScreenViewport): void { }

  /**
   * Add attribution logo cards for the data supplied by this provider to the [[Viewport]]'s logo div.
   * @param _cards Logo cards HTML element that may contain custom data attributes.
   * @param _viewport Viewport to add logo cards to.
   * @beta
   */
  public async addAttributions(cards: HTMLTableElement, vp: ScreenViewport): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return Promise.resolve(this.addLogoCards(cards, vp));
  }

  /** @internal */
  protected _missingTileData?: Uint8Array;

  /** @internal */
  public get transparentBackgroundString(): string { return this._settings.transparentBackground ? "true" : "false"; }

  /** @internal */
  protected async _areChildrenAvailable(_tile: ImageryMapTile): Promise<boolean> { return true; }

  /** @internal */
  public getPotentialChildIds(quadId: QuadId): QuadId[] {
    const childLevel = quadId.level + 1;
    return quadId.getChildIds(this.tilingScheme.getNumberOfXChildrenAtLevel(childLevel), this.tilingScheme.getNumberOfYChildrenAtLevel(childLevel));
  }

  /**
   * Get child IDs of a quad and generate tiles based on these child IDs.
   * See [[ImageryTileTree._loadChildren]] for the definition of `resolveChildren` where this function is commonly called.
   * @param quadId quad to generate child IDs for.
   * @param resolveChildren Function that creates tiles from child IDs.
   * @beta
   */
  protected _generateChildIds(quadId: QuadId, resolveChildren: (childIds: QuadId[]) => void) {
    resolveChildren(this.getPotentialChildIds(quadId));
  }

  /** @internal */
  public generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    if (tile.depth >= this.maximumZoomLevel || (undefined !== this.cartoRange && this._filterByCartoRange && !this.cartoRange.intersectsRange(tile.rectangle))) {
      tile.setLeaf();
      return;
    }
    this._generateChildIds(tile.quadId, resolveChildren);
  }

  /**
   * Get tooltip text for a specific quad and cartographic position.
   * @param strings List of strings to contain tooltip text.
   * @param quadId Quad ID to get tooltip for.
   * @param _carto Cartographic that may be used to retrieve and/or format tooltip text.
   * @param tree Tree associated with the quad to get the tooltip for.
   * @internal
   */
  public async getToolTip(strings: string[], quadId: QuadId, _carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    if (doDebugToolTips) {
      const range = quadId.getLatLongRangeDegrees(tree.tilingScheme);
      strings.push(`QuadId: ${quadId.debugString}, Lat: ${range.low.x} - ${range.high.x} Long: ${range.low.y} - ${range.high.y}`);
    }
  }

  /** @internal */
  public async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], _quadId: QuadId, _carto: Cartographic, _tree: ImageryMapTileTree, _hit: HitDetail, _options?: MapFeatureInfoOptions): Promise<void> {
    // default implementation; simply return an empty feature info
    featureInfos.push({ layerName: this._settings.name });
  }

  /** @internal */
  public  decorate(_context: DecorateContext): void {
  }

  /** @internal */
  protected async getImageFromTileResponse(tileResponse: Response, zoomLevel: number) {
    const arrayBuffer = await tileResponse.arrayBuffer();
    const byteArray: Uint8Array = new Uint8Array(arrayBuffer);
    if (!byteArray || (byteArray.length === 0))
      return undefined;
    if (this.matchesMissingTile(byteArray) && zoomLevel > 8)
      return undefined;

    const contentType = tileResponse.headers.get("content-type")?.toLowerCase();
    let imageFormat: ImageSourceFormat | undefined;
    if (contentType) {
      // Note: 'includes' is used here instead of exact comparison because we encountered
      // some servers that would give content type such as 'image/png;charset=UTF-8'.
      if (contentType.includes("image/jpeg"))
        imageFormat = ImageSourceFormat.Jpeg;
      else if (contentType.includes("image/png"))
        imageFormat = ImageSourceFormat.Png;
    }

    if (imageFormat !== undefined)
      return new ImageSource(byteArray, imageFormat);

    assert(false, "Invalid tile content type");
    return undefined;
  }

  /**
   * Change the status of this provider.
   * Sub-classes should override 'onStatusUpdated' instead of this method.
   * @internal
   */
  public setStatus(status: MapLayerImageryProviderStatus) {
    if (this._status !== status) {
      this.onStatusUpdated(status);
      this._status = status;
      this.onStatusChanged.raiseEvent(this);
    }
  }

  /** Method called whenever the status changes, giving the opportunity to sub-classes to have a custom behavior.
   *  @internal
   */
  protected onStatusUpdated(_newStatus: MapLayerImageryProviderStatus) { }

  /** @internal */
  protected setRequestAuthorization(headers: Headers) {
    if (this._settings.userName && this._settings.password) {
      setBasicAuthorization(headers, this._settings.userName, this._settings.password);
    }
  }

  /** The access client registered for this layer's format, if any.
   * @internal
   */
  protected get accessClient(): MapLayerAccessClient | undefined {
    return IModelApp.mapLayerFormatRegistry?.getAccessClient(this._settings.formatId);
  }

  /** Context identifying this layer, passed to the access client's callbacks.
   * @internal
   */
  protected get accessTokenParams(): MapLayerAccessTokenParams {
    return { mapLayerUrl: new URL(this._settings.url), userName: this._settings.userName, password: this._settings.password };
  }

  /** Gives the access client registered for this layer's format the opportunity to authenticate the outgoing
   * request via [[MapLayerAccessClient.applyToRequest]], mutating the URL's query parameters and `headers` in place.
   * @returns true if the request was shaped by the access client.
   * @internal
   */
  protected async applyAccessClientAuth(url: URL, headers: Headers): Promise<boolean> {
    return applyAccessClientToRequest(url, headers, this.accessTokenParams, this.accessClient);
  }

  /** Returns true if the given response represents an authentication failure for a request shaped by
   * [[MapLayerAccessClient.applyToRequest]]. Delegates to [[MapLayerAccessClient.isAuthenticationError]] when
   * defined; otherwise treats HTTP 401/403 as authentication failures.
   * @internal
   */
  protected async isAccessClientAuthFailure(response: Response): Promise<boolean> {
    return isAccessClientAuthFailure(response, this.accessTokenParams, this.accessClient);
  }

  /** Returns true if the given URL has the same origin as this layer's settings URL.
   * Used to avoid leaking credentials to third-party hosts.
   * @internal
   */
  protected matchesSettingsUrlOrigin(url: string): boolean {
    const origin = tryGetOrigin(url);
    return origin !== undefined && origin === tryGetOrigin(this._settings.url);
  }

  /** Returns true if the basic-auth credentials from the layer settings may be attached to a request to the given URL.
   * Always true unless [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled (opt-in).
   * When enabled, the origin of this layer's settings URL is implicitly trusted (the credentials belong to that
   * server); other origins must be listed in [[MapLayerFormatRegistry.trustedCredentialsOrigins]].
   * See [[MapLayerFormatRegistry.isCredentialsSharingAllowed]].
   * @internal
   */
  protected isCredentialsSharingAllowed(url: string): boolean {
    return IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(url, this._settings.url);
  }

  /** Returns true if a request to the given URL may be retried with browser credentials included
   * (i.e. SSO / Windows Authentication) after an NTLM or Negotiate http 401 challenge.
   * See [[MapLayerFormatRegistry.isSsoAllowed]].
   * @internal
   */
  protected isSsoAllowed(url: string): boolean {
    return IModelApp.mapLayerFormatRegistry.isSsoAllowed(url);
  }

  /** @internal */
  public async makeTileRequest(url: string, timeoutMs?: number, authorization?: string): Promise<Response> {

    // We want to complete the first request before letting other requests go;
    // this done to avoid flooding server with requests missing credentials
    if (!this._firstRequestPromise)
      this._firstRequestPromise  = new Promise<void>((resolve: any) => this.onFirstRequestCompleted.addOnce(()=>resolve()));
    else
      await this._firstRequestPromise;

    let response: Response|undefined;
    try {
      response = await this.makeRequest(url, timeoutMs, authorization);
    } finally {
      this.onFirstRequestCompleted.raiseEvent();
    }

    if (response === undefined)
      throw new Error("fetch call failed");

    return response;
  }

  /** Records the given URL's origin and transitions the status to [[MapLayerImageryProviderStatus.UntrustedOrigin]].
   * Called when a request received an authentication challenge that could not be answered because the origin
   * is not trusted (see [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]]).
   * Raises [[onStatusChanged]] on the status transition, and again whenever a new origin is added.
   * @internal
   */
  protected reportBlockedOrigin(url: string): void {
    const origin = tryGetOrigin(url) ?? url;
    const isNewOrigin = !this._blockedOrigins.has(origin);
    this._blockedOrigins.add(origin);

    if (this._status !== MapLayerImageryProviderStatus.UntrustedOrigin)
      this.setStatus(MapLayerImageryProviderStatus.UntrustedOrigin);
    else if (isNewOrigin)
      this.onStatusChanged.raiseEvent(this);   // status unchanged, but a new origin was blocked
  }

  /** Logs a warning (once per origin, app-wide) when credentials are sent to an origin that would be blocked
   * if [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] were enabled.
   * Helps applications discover the origins they need to whitelist before opting in to the restriction.
   * See [[MapLayerFormatRegistry.logUntrustedOriginUse]].
   * @internal
   */
  protected logUntrustedOriginUse(url: string): void {
    IModelApp.mapLayerFormatRegistry.logUntrustedOriginUse(url);
  }

  /** The redirect policy to apply to a request that carries browser credentials (see [[includeUserCredentials]]).
   *
   * When [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is enabled, redirects are refused
   * outright (`"error"`). `fetch` cannot be asked to follow only same-origin redirects, and by the time a
   * followed redirect can be inspected the credentials have already been delivered to the destination — so
   * refusing is the only way to honour the guarantee that credentials reach none but the origins listed in
   * [[MapLayerFormatRegistry.trustedCredentialsOrigins]]. Legitimate same-origin redirects fail as a result;
   * that is the cost of the opt-in restriction.
   *
   * When the restriction is disabled (the default), redirects are followed as before and
   * [[checkCredentialedRedirect]] reports the destination after the fact.
   * @internal
   */
  protected get credentialedRedirect(): RequestRedirect | undefined {
    return IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
  }

  /** Detects that a request carrying browser credentials (see [[includeUserCredentials]]) was transparently
   * redirected to a different origin, and reports or logs that origin.
   *
   * This is a **best-effort, after-the-fact** signal used only while
   * [[MapLayerFormatRegistry.restrictCredentialsToTrustedOrigins]] is disabled, where credentialed requests
   * still follow redirects (see [[credentialedRedirect]]). It cannot prevent the exposure — the credentials
   * have already been sent — and it does not fire at all when the destination denies CORS, because `fetch`
   * then rejects instead of returning a `Response`. The destination origin is never latched as SSO-succeeded,
   * so credentials do not keep flowing to it.
   * @internal
   */
  protected checkCredentialedRedirect(requestedUrl: string, response: Response): void {
    const finalOrigin = tryGetOrigin(response.url);
    if (!response.url || finalOrigin === undefined || finalOrigin === tryGetOrigin(requestedUrl))
      return;

    if (!this.isSsoAllowed(response.url))
      this.reportBlockedOrigin(response.url);
    else
      this.logUntrustedOriginUse(response.url);   // no-op when the restriction is enabled
  }

  /** @internal */
  public async makeRequest(url: string, timeoutMs?: number, authorization?: string): Promise<Response> {

    let response: Response|undefined;

    let headers: Headers | undefined;
    let hasCreds = false;
    // Whether this request had basic-auth credentials of its own to offer. Requests carrying a caller-supplied
    // `authorization` are excluded: those bypass the origin policy entirely.
    const hasSettingsCreds = !authorization && !!this._settings.userName && !!this._settings.password;
    if (authorization) {
      headers = new Headers();
      headers.set("Authorization", authorization);
    } else if (hasSettingsCreds) {
      if (this.isCredentialsSharingAllowed(url)) {
        hasCreds = true;
        headers = new Headers();
        this.setRequestAuthorization(headers);
        if (!this.matchesSettingsUrlOrigin(url))
          this.logUntrustedOriginUse(url);
      }
    }

    // Give the format's registered access client full control over the outgoing request (e.g. an Authorization
    // header for a service behind an authenticating proxy). Applied last so its headers take precedence.
    let requestUrl = url;
    let clientAuthApplied = false;
    if (this.accessClient?.applyToRequest) {
      try {
        const urlObj = new URL(url);
        headers = headers ?? new Headers();
        clientAuthApplied = await this.applyAccessClientAuth(urlObj, headers);
        requestUrl = urlObj.toString();
      } catch {
        // Not a parseable absolute URL; let fetch fail (or succeed) on the original request unshaped.
      }
    }

    const includeCredentials = this.includeUserCredentials(requestUrl);
    const opts: RequestInit = {
      method: "GET",
      headers,
      credentials: includeCredentials ? "include" : undefined,
      // Client-shaped requests carry secrets too, so they get the same redirect policy as credentialed ones.
      redirect: (includeCredentials || clientAuthApplied) ? this.credentialedRedirect : undefined,
    };

    if (timeoutMs !== undefined)
      setRequestTimeout(opts, timeoutMs);

    response = await fetch(requestUrl, opts);

    if (includeCredentials || clientAuthApplied)
      this.checkCredentialedRedirect(requestUrl, response);

    // fetch follows redirects transparently, so all trust decisions below target the final
    // (post-redirect) URL reported by the response, not the URL we asked for.
    const challengedUrl = response.url || requestUrl;

    if (response.status === 401
          && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])
          && !includeCredentials
          && !hasCreds
          && !clientAuthApplied
    ) {
      if (this.isSsoAllowed(challengedUrl)) {
        // Removed the previous headers and make sure "include" credentials is set
        opts.headers = undefined;
        opts.credentials = "include";
        // A Negotiate/NTLM handshake is normally a same-URL 401 round-trip, but in legacy mode we preserve
        // the previous behavior and allow the browser to follow redirects after the authenticated retry.
        opts.redirect = IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins ? "error" : undefined;
        this.logUntrustedOriginUse(challengedUrl);

        // We got a http 401 challenge, lets try again with SSO enabled (i.e. Windows Authentication)
        response = await fetch(challengedUrl, opts);
        if (response.status === 200) {
          this.recordSsoSucceeded(challengedUrl);    // avoid going through 401 challenges over and over for this origin
        }
      } else {
        this.reportBlockedOrigin(challengedUrl);
      }
    } else if ((response.status === 401 || response.status === 403) && hasSettingsCreds && !this.isCredentialsSharingAllowed(challengedUrl)) {
      // Some servers answer an unauthenticated request with 403 (Forbidden) rather than a 401 challenge;
      // since this request could not present its credentials to the challenging origin, either status most
      // likely results from that. The permission is recomputed for the challenged URL rather than reusing the
      // decision made for the requested one: `fetch` strips the Authorization header when it follows a
      // cross-origin redirect, so a trusted request can still arrive unauthenticated at an untrusted origin,
      // and conversely a request that started out untrusted may end up at an origin that is trusted.
      this.reportBlockedOrigin(challengedUrl);
    }

    if (clientAuthApplied && await this.isAccessClientAuthFailure(response))
      this.setStatus(MapLayerImageryProviderStatus.RequireAuth);

    return response;
  }

  /** Returns a map layer tile at the specified settings. */
  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    try {
      const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
      if (tileUrl.length === 0)
        return undefined;

      const tileResponse: Response = await this.makeTileRequest(tileUrl);

      if (!this._hasSuccessfullyFetchedTile) {
        this._hasSuccessfullyFetchedTile = true;
      }

      return await this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error: any) {
      if (error?.status === 401) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);

        // Only report error to end-user if we were previously able to fetch tiles
        // and then encountered an error, otherwise I assume an error was already reported
        // through the source validation process.
        if (this._hasSuccessfullyFetchedTile) {
          const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.LoadTileTokenError", { layerName: this._settings.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }

      }
      return undefined;
    }
  }

  /** @internal */
  protected async toolTipFromUrl(strings: string[], url: string): Promise<void> {
    let headers: Headers | undefined;
    if (this.isCredentialsSharingAllowed(url)) {
      headers = new Headers();
      this.setRequestAuthorization(headers);
    }

    let requestUrl = url;
    let clientAuthApplied = false;
    if (this.accessClient?.applyToRequest) {
      try {
        const urlObj = new URL(url);
        headers = headers ?? new Headers();
        clientAuthApplied = await this.applyAccessClientAuth(urlObj, headers);
        requestUrl = urlObj.toString();
      } catch {
        // Not a parseable absolute URL; issue the original request unshaped.
      }
    }

    try {
      const includeCredentials = this.includeUserCredentials(requestUrl);
      const response = await fetch(requestUrl, {
        method: "GET",
        headers,
        credentials: includeCredentials ? "include" : undefined,
        redirect: (includeCredentials || clientAuthApplied) ? this.credentialedRedirect : undefined,
      });
      if (includeCredentials || clientAuthApplied)
        this.checkCredentialedRedirect(requestUrl, response);
      let text = await response.text();
      if (text) {
        // Tooltip content (e.g. WMS GetFeatureInfo responses) is rendered as HTML downstream and may
        // deliberately contain markup; text from origins not trusted for credentials is escaped.
        // fetch follows redirects transparently, so the text may come from a different origin than requested.
        if (!this.isCredentialsSharingAllowed(response.url || requestUrl))
          text = escapeHtml(text);
        strings.push(text);
      }
    } catch {
    }
  }

  /** @internal */
  public matchesMissingTile(tileData: Uint8Array): boolean {
    if (!this._missingTileData)
      return false;
    if (tileData.length !== this._missingTileData.length)
      return false;
    for (let i: number = 0; i < tileData.length; i += 10) {
      if (this._missingTileData[i] !== tileData[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculates the projected x cartesian coordinate in EPSG:3857 from the longitude in EPSG:4326 (WGS84)
   * @param longitude Longitude in EPSG:4326 (WGS84)
   * @internal
   */
  public getEPSG3857X(longitude: number): number {
    return longitude * 20037508.34 / 180.0;
  }

  /**
   * Calculates the projected y cartesian coordinate in EPSG:3857 from the latitude in EPSG:4326 (WGS84)
   * @param latitude Latitude in EPSG:4326 (WGS84)
   * @internal
   */
  public getEPSG3857Y(latitude: number): number {
    const y = Math.log(Math.tan((90.0 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
    return y * 20037508.34 / 180.0;
  }

  /**
   * Calculates the longitude in EPSG:4326 (WGS84) from the projected x cartesian coordinate in EPSG:3857
   * @param x3857 Projected x cartesian coordinate in EPSG:3857
   * @internal
   */
  public getEPSG4326Lon(x3857: number): number {
    return Angle.radiansToDegrees(x3857 / earthRadius);
  }

  /**
   * Calculates the latitude in EPSG:4326 (WGS84) from the projected y cartesian coordinate in EPSG:3857
   * @param y3857 Projected y cartesian coordinate in EPSG:3857
   * @internal
   */
  public getEPSG4326Lat(y3857: number): number {
    const y = 2 * Math.atan(Math.exp(y3857 / earthRadius)) - (Math.PI / 2);
    return Angle.radiansToDegrees(y);
  }

  /**
   * Get the bounding box/extents of a tile in EPSG:4326 (WGS84) format.
   * Map tile providers like Bing and Mapbox allow the URL to be constructed directly from the zoom level and tile coordinates.
   * However, WMS-based servers take a bounding box instead. This method can help get that bounding box from a tile.
   * @param row Row of the tile
   * @param column Column of the tile
   * @param zoomLevel Desired zoom level of the tile
   * @internal
   */
  public getEPSG4326Extent(row: number, column: number, zoomLevel: number): WGS84Extent {
    // Shift left (this.tileSize << zoomLevel) overflow when using 512 pixels tile at higher resolution,
    // so use Math.pow instead (I assume the performance lost to be minimal)
    const mapSize = this.tileSize * Math.pow(2, zoomLevel);
    const leftGrid = this.tileSize * column;
    const topGrid = this.tileSize * row;

    const longitudeLeft = 360 * ((leftGrid / mapSize) - 0.5);
    const y0 = 0.5 - ((topGrid + this.tileSize) / mapSize);
    const latitudeBottom = 90.0 - 360.0 * Math.atan(Math.exp(-y0 * 2 * Math.PI)) / Math.PI;

    const longitudeRight = 360 * (((leftGrid + this.tileSize) / mapSize) - 0.5);
    const y1 = 0.5 - (topGrid / mapSize);
    const latitudeTop = 90.0 - 360.0 * Math.atan(Math.exp(-y1 * 2 * Math.PI)) / Math.PI;

    return { longitudeLeft, longitudeRight, latitudeTop, latitudeBottom };
  }

  /**
   * Get the bounding box/extents of a tile in EPSG:3857 format.
   * @param row Row of the tile
   * @param column Column of the tile
   * @param zoomLevel Desired zoom level of the tile
   * @internal
   */
  public getEPSG3857Extent(row: number, column: number, zoomLevel: number): { left: number, right: number, top: number, bottom: number } {
    const epsg4326Extent = this.getEPSG4326Extent(row, column, zoomLevel);

    const left = this.getEPSG3857X(epsg4326Extent.longitudeLeft);
    const right = this.getEPSG3857X(epsg4326Extent.longitudeRight);
    const bottom = this.getEPSG3857Y(epsg4326Extent.latitudeBottom);
    const top = this.getEPSG3857Y(epsg4326Extent.latitudeTop);

    return { left, right, bottom, top };
  }

  /** @internal */
  public getEPSG3857ExtentString(row: number, column: number, zoomLevel: number) {
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    return `${tileExtent.left.toFixed(2)},${tileExtent.bottom.toFixed(2)},${tileExtent.right.toFixed(2)},${tileExtent.top.toFixed(2)}`;
  }

  /** @internal */
  public getEPSG4326TileExtentString(row: number, column: number, zoomLevel: number, latLongAxisOrdering: boolean) {
    const tileExtent = this.getEPSG4326Extent(row, column, zoomLevel);
    return this.getEPSG4326ExtentString(tileExtent, latLongAxisOrdering);

  }

  /** @internal */
  public getEPSG4326ExtentString(tileExtent: WGS84Extent, latLongAxisOrdering: boolean) {

    if (latLongAxisOrdering) {
      return `${tileExtent.latitudeBottom.toFixed(8)},${tileExtent.longitudeLeft.toFixed(8)},${tileExtent.latitudeTop.toFixed(8)},${tileExtent.longitudeRight.toFixed(8)}`;
    } else {
      return `${tileExtent.longitudeLeft.toFixed(8)},${tileExtent.latitudeBottom.toFixed(8)},${tileExtent.longitudeRight.toFixed(8)},${tileExtent.latitudeTop.toFixed(8)}`;
    }
  }

  /** Append custom parameters for settings to provided URL object.
   * @internal
   */
  protected appendCustomParams(url: string) {
    if (!this._settings.savedQueryParams && !this._settings.unsavedQueryParams)
      return url;

    let tmpUrl = appendQueryParams(url, this._settings.savedQueryParams);
    tmpUrl = appendQueryParams(tmpUrl, this._settings.unsavedQueryParams);
    return tmpUrl;
  }
}
