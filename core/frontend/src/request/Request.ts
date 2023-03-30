/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export class RequestGlobalOptions {
  // Assume application is online or offline. This hint skip retry/timeout
  public static online: boolean = true;
}

/** @internal */
export interface RequestBasicCredentials { // axios: AxiosBasicCredentials
  user: string; // axios: username
  password: string; // axios: password
}

/** Error object that's thrown if the status is *not* in the range of 200-299 (inclusive).
 * @internal
 */
export class HttpResponseError extends Error {

  public constructor(
    public status: number,
    public responseText?: string,
  ) {
    let message = `HTTP response status code: ${status}.`;
    if (responseText)
      message += ` Response body: ${responseText}`;

    super(message);
  }
}

/** @internal */
export interface RequestOptions {
  retryCount?: number;
  headers?: any;
  timeout?: number;
  auth?: RequestBasicCredentials;
}

/** @internal */
export async function request(url: string, responseType: "arraybuffer", options?: RequestOptions): Promise<ArrayBuffer>;

/** @internal */
export async function request(url: string, responseType: "json", options?: RequestOptions): Promise<any>;

/** @internal */
export async function request(url: string, responseType: "text", options?: RequestOptions): Promise<string>;

/** @internal */
export async function request(url: string, responseType: "arraybuffer" | "json" | "text", options?: RequestOptions): Promise<any> {
  if (!RequestGlobalOptions.online)
    throw new HttpResponseError(503);

  const headers: any = {
    ...options?.headers,
  }

  if (options?.auth)
    headers.authorization = `Basic ${btoa(`${options.auth.user}:${options.auth.password}`)}`;

  const fetchOptions: RequestInit = {
    headers,
    signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined,
  }

  const fetchFunc = () => fetch(url, fetchOptions);
  const response = await fetchWithRetry(fetchFunc, options?.retryCount ?? 4);

  if (!response.ok)
    throw new HttpResponseError(response.status, await response.text());

  switch (responseType) {
    case "arraybuffer":
      return response.arrayBuffer();
    case "json":
      return response.json();
    case "text":
      return response.text();
  }
}

async function fetchWithRetry(fetchFunc: () => Promise<Response>, remainingRetries: number): Promise<Response> {
  try {
    return await fetchFunc();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError")
      throw error;

    if (remainingRetries === 0)
      throw error;

    return fetchWithRetry(fetchFunc, --remainingRetries);
  }
}

/**
 * @internal
 * @deprecated in 4.0.
 */
export interface ProgressInfo {
  percent?: number;
  total?: number;
  loaded: number;
}

/**
 * @internal
 * @deprecated in 4.0. Use [[OnDownloadProgress]].
 */
export type ProgressCallback = (progress: ProgressInfo) => void;
