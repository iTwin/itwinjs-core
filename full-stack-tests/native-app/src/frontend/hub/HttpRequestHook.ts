/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RequestGlobalOptions } from "@bentley/itwin-client";
import { TestRpcInterface } from "../../common/RpcInterfaces";

const NATIVE_XHR = Symbol.for("NATIVE_XHR");
const NATIVE_FETCH = Symbol.for("NATIVE_FETCH");

class XMLHttpRequestProxy {
  public static useFetch: boolean = true;
  public static readonly DONE: number = 4;
  public static readonly HEADERS_RECEIVED: number = 2;
  public static readonly LOADING: number = 3;
  public static readonly OPENED: number = 1;
  public static readonly UNSENT: number = 0;
  private _fetchResponse?: Response;
  private _fetchPromise?: Promise<Response>;
  private _fetchText?: string;
  private _xhrMethod?: string;
  private _xhrHeaders?: Headers;
  private _xhrUrl?: string;
  private _xhrWithCredentials?: boolean;
  private _xhrOnReadyStateChange?: (() => any) | null;
  private _nativeXhr?: XMLHttpRequest;
  private _xhrOnAbort?: (() => any) | null;
  private _xhrOnError?: (() => any) | null;
  private _xhrOnLoad?: (() => any) | null;
  private _xhrOnLoadend?: (() => any) | null;
  private _xhrOnLoadStart?: (() => any) | null;
  private _xhrOnProgress?: (() => any) | null;
  private _xhrOnTimeout?: (() => any) | null;
  constructor() {
    if (!XMLHttpRequestProxy.useFetch) {
      this._nativeXhr = new (window as any)[NATIVE_XHR]();
    }
  }
  public get readyState(): number {
    if (this._nativeXhr) {
      return this._nativeXhr.readyState;
    }
    if (this._fetchResponse) {
      return XMLHttpRequestProxy.DONE;
    }
    if (this._xhrUrl) {
      return XMLHttpRequestProxy.OPENED;
    }
    return XMLHttpRequestProxy.UNSENT;
  }
  public get response(): any {
    if (this._nativeXhr) {
      return this._nativeXhr.response;
    }
    return this.responseText;
  }
  public get responseText(): string {
    if (this._nativeXhr) {
      return this._nativeXhr.responseText;
    }
    return this._fetchText!;
  }
  public get responseType(): any {
    if (this._nativeXhr) {
      return this._nativeXhr.responseType;
    }
    if (this._fetchResponse) {
      const contentType = this._fetchResponse.headers.get("Content-Type")!;
      if (contentType.search("json") >= 0)
        return "json";

      if (contentType.search("text") >= 0)
        return "text";

      if (contentType.search("octet-stream") >= 0)
        return "blob";

      return "arraybuffer";
    }
    return "";
  }
  public get responseURL(): any {
    if (this._nativeXhr) {
      return this._nativeXhr.responseURL;
    }
    return this._fetchResponse!.url;
  }
  public get responseXML(): any {
    if (this._nativeXhr) {
      return this._nativeXhr.responseXML;
    }
    const parser = new DOMParser();
    return parser.parseFromString(this.responseText, "text/xml");
  }
  public get status(): number {
    if (this._nativeXhr) {
      return this._nativeXhr.status;
    }
    return this._fetchResponse!.status;
  }
  public get statusText(): string {
    if (this._nativeXhr) {
      return this._nativeXhr.statusText;
    }
    return this._fetchResponse!.statusText;
  }
  public get timeout(): number {
    if (this._nativeXhr) {
      return this._nativeXhr.timeout;
    }
    const timeoutHdr = this.getRequestHeader("timeout");
    if (timeoutHdr) {
      return Number(timeoutHdr);
    }
    return 0;
  }
  public set timeout(value: number) {
    if (this._nativeXhr) {
      this._nativeXhr.timeout = value;
    } else {
      this.setRequestHeader("timeout", value.toString());
    }
  }
  public get withCredentials(): boolean {
    if (this._nativeXhr) {
      return this._nativeXhr.withCredentials;
    }
    return this._xhrWithCredentials!;
  }
  public set withCredentials(value: boolean) {
    if (this._nativeXhr) {
      this._nativeXhr.withCredentials = value;
    } else {
      this._xhrWithCredentials = value;
    }
  }
  public set onreadystatechange(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onreadystatechange = value;
    } else {
      this._xhrOnReadyStateChange = value;
    }
  }
  public set onabort(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onabort = value;
    } else {
      this._xhrOnAbort = value;
    }
  }
  public set onerror(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onerror = value;
    } else {
      this._xhrOnError = value;
    }
  }
  public set onload(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onload = value;
    } else {
      this._xhrOnLoad = value;
    }
  }
  public set onloadend(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onloadend = value;
    } else {
      this._xhrOnLoadend = value;
    }
  }
  public set onloadstart(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onloadstart = value;
    } else {
      this._xhrOnLoadStart = value;
    }
  }
  public set onprogress(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.onprogress = value;
    } else {
      this._xhrOnProgress = value;
    }
  }
  public set ontimeout(value: (() => any) | null) {
    if (this._nativeXhr) {
      this._nativeXhr.ontimeout = value;
    } else {
      this._xhrOnTimeout = value;
    }
  }
  public open(method: string, url: string, async: boolean = false, username?: string | null, password?: string | null): void {
    if (this._nativeXhr) {
      this._nativeXhr.open(method, url, async, username, password);
    } else {
      this._xhrMethod = method;
      this._xhrUrl = url;
      if (username) {
        this.setRequestHeader("Authorization", `Basic ${btoa(`${username}:${password}`)}`);
      }
    }
  }
  public overrideMimeType(mime: string): void {
    if (this._nativeXhr) {
      this._nativeXhr.overrideMimeType(mime);
    } else {
      this.setRequestHeader("Content-Type", mime);
    }
  }
  public abort(): void {
    if (this._nativeXhr) {
      this._nativeXhr.abort();
    } else {
      if (this._xhrOnAbort) {
        this._xhrOnAbort();
      }
    }
  }
  public getAllResponseHeaders(): string {
    if (this._nativeXhr) {
      return this._nativeXhr.getAllResponseHeaders();
    }
    let headers: string = "";
    this._fetchResponse?.headers.forEach((val, key) => {
      headers += `${key}: ${val}\r\n`;
    });
    return headers;
  }
  public getResponseHeader(name: string): string | null | undefined {
    if (this._nativeXhr) {
      return this._nativeXhr.getResponseHeader(name);
    }
    return this._fetchResponse?.headers.get(name);
  }
  public send(xhrBody?: any): void {
    if (this._nativeXhr) {
      return this._nativeXhr.send(xhrBody);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._fetchPromise = fetch(this._xhrUrl!, {
      body: xhrBody,
      method: this._xhrMethod,
      headers: this._xhrHeaders,
      redirect: "follow",
      credentials: "same-origin",
    });
    this.hookCallbacks();
  }
  private hookCallbacks() {
    this._fetchPromise!.then(async (value: Response) => {
      this._fetchResponse = value;
      this._fetchText = await value.text();
      if (this._xhrOnReadyStateChange) {
        this._xhrOnReadyStateChange();
      }
      if (this._fetchResponse.status === 408) {
        if (this._xhrOnTimeout) {
          this._xhrOnTimeout();
        }
      }
      if (this._xhrOnProgress) {
        this._xhrOnProgress();
      }
      if (this._xhrOnLoadStart) {
        this._xhrOnLoadStart();
      }
      if (this._xhrOnLoad) {
        this._xhrOnLoad();
      }
      if (this._xhrOnLoadend) {
        this._xhrOnLoadend();
      }
      return value;
    }).catch((_reason) => {
      if (this._xhrOnError) {
        this._xhrOnError();
      }
    });
  }
  private getRequestHeader(name: string): string | null | undefined {
    if (!this._xhrHeaders) {
      this._xhrHeaders = new Headers();
    }
    return this._xhrHeaders.get(name);
  }
  public setRequestHeader(name: string, value: string): void {
    if (this._nativeXhr) {
      this._nativeXhr.setRequestHeader(name, value);
    }
    if (!this._xhrHeaders) {
      this._xhrHeaders = new Headers();
    }
    this._xhrHeaders.set(name, value);
  }
}

class FetchProxy {
  public static async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const req: Request = input instanceof Request ? input : new Request(input, init);
    const beforeHandlers = HttpHandler.handlers.filter((value) => {
      return value.canHandle(req.url) && value.before;
    });
    if (beforeHandlers.length > 0) {
      const resp = beforeHandlers[0].before!(req);
      if (resp instanceof Response)
        return resp;
    }
    const win = window as any;
    const response = await win[NATIVE_FETCH](req);

    const afterHandlers = HttpHandler.handlers.filter((value) => {
      return value.canHandle(req.url) && value.after;
    });
    if (afterHandlers.length > 0) {
      return afterHandlers[0].after!(response);
    }
    return response;
  }
}
export interface IHttpHandler {
  onRequest(callback: (input: Request) => Response | undefined | null): IHttpHandler;
  onResponse(callback: (input: Response) => Response): IHttpHandler;
}
class HttpHandler implements IHttpHandler {
  public static handlers: HttpHandler[] = [];
  constructor(private _urlRegEx: RegExp | string) { }
  public before?: (input: Request) => Response | undefined | null;
  public after?: (input: Response) => Response;
  public canHandle(url: string): boolean {
    if (!this.after && !this.before)
      return false;

    if (this._urlRegEx instanceof RegExp) {
      return url.match(this._urlRegEx) !== null;
    }
    return url.startsWith(this._urlRegEx);
  }
  public onRequest(callback: (input: Request) => Response | undefined | null): IHttpHandler {
    this.before = callback;
    return this;
  }
  public onResponse(callback: (input: Response) => Response): IHttpHandler {
    this.after = callback;
    return this;
  }
  public static accept(url: RegExp | string): IHttpHandler {
    const handler = new HttpHandler(url);
    this.handlers.push(handler);
    return handler;
  }

}
export class HttpRequestHook {
  public static install() {
    const win = window as any;
    if (typeof win[NATIVE_XHR] === "undefined") {
      win[NATIVE_XHR] = window.XMLHttpRequest;
      win.XMLHttpRequest = XMLHttpRequestProxy;
    }
    if (typeof win[NATIVE_FETCH] === "undefined") {
      win[NATIVE_FETCH] = window.fetch;
      win.fetch = FetchProxy.fetch;
    }
  }

  public static accept(url: RegExp | string): IHttpHandler {
    return HttpHandler.accept(url);
  }

  public static uninstall() {
    HttpHandler.handlers = [];
    const win = window as any;
    if (typeof win[NATIVE_XHR] !== "undefined") {
      win.XMLHttpRequest = win[NATIVE_XHR];
      delete win[NATIVE_XHR];
    }
    if (typeof win[NATIVE_FETCH] !== "undefined") {
      win.fetch = win[NATIVE_FETCH];
      delete win[NATIVE_FETCH];
    }
  }
}
export async function usingOfflineScope<TResult>(func: () => Promise<TResult>): Promise<TResult> {
  return usingBackendOfflineScope(async () => {
    return usingFrontendOfflineScope(func);
  });
}
export async function usingBackendOfflineScope<TResult>(func: () => Promise<TResult>): Promise<TResult> {
  await TestRpcInterface.getClient().beginOfflineScope();
  const endScope = async () => {
    await TestRpcInterface.getClient().endOfflineScope();
  };
  const result = func();
  result.then(endScope, endScope);
  return result;
}
export async function usingFrontendOfflineScope<TResult>(func: () => Promise<TResult>): Promise<TResult> {
  const timeoutOldValue = { ...RequestGlobalOptions.timeout };
  const maxRetriesOldValue = RequestGlobalOptions.maxRetries;
  HttpRequestHook.install();
  HttpRequestHook.accept("http://localhost")
    .onRequest(() => undefined)
    .onResponse((resp) => resp);
  HttpRequestHook.accept(/^.*$/)
    .onRequest((_req) => {
      return new Response(null, { status: 503 });
    });
  RequestGlobalOptions.timeout = { deadline: 5000, response: 5000 };
  RequestGlobalOptions.maxRetries = 0;
  const endScope = () => {
    HttpRequestHook.uninstall();
    Object.assign(RequestGlobalOptions.timeout, timeoutOldValue);
    RequestGlobalOptions.maxRetries = maxRetriesOldValue;
  };
  const result = func();
  result.then(endScope, endScope);
  return result;
}
