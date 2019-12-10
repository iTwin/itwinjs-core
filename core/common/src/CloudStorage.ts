/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CloudStorage */

/** @beta */
export enum CloudStorageProvider {
  Azure,
  Amazon,
  AliCloud,
  External,
  Unknown,
}

/** @beta */
export interface CloudStorageContainerDescriptor {
  provider?: CloudStorageProvider;
  name: string;
  resource?: string;
}

/** @beta */
export interface CloudStorageContainerUrl {
  descriptor: CloudStorageContainerDescriptor;
  valid: number;
  expires: number;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  bound?: boolean;
}

/** @beta */
export namespace CloudStorageContainerUrl {
  export function empty(): CloudStorageContainerUrl {
    return {
      descriptor: { name: "" },
      valid: 0,
      expires: 0,
      url: "",
    };
  }
}

/** @beta */
export abstract class CloudStorageCache<TContentId, TContentType> {
  private _containers: Map<string, CloudStorageContainerUrl>;

  public provider: CloudStorageProvider = CloudStorageProvider.Unknown;
  public abstract formContainerName(id: TContentId): string;
  public abstract formResourceName(id: TContentId): string;
  protected formContainerKey(id: TContentId): string { return this.formContainerName(id); }
  protected abstract obtainContainerUrl(id: TContentId, descriptor: CloudStorageContainerDescriptor): Promise<CloudStorageContainerUrl>;
  protected abstract instantiateResource(response: Response): Promise<TContentType | undefined>;
  protected supplyUrlBase(_container: CloudStorageContainerUrl, _id: TContentId): string | undefined { return undefined; }

  public constructor() {
    this._containers = new Map();
  }

  public async retrieve(id: TContentId): Promise<TContentType | undefined> {
    return new Promise(async (resolve) => {
      try {
        const container = await this.getContainer(id);
        if (!container.url) {
          resolve(undefined);
          return;
        }

        const response = await this.requestResource(container, id);
        if (response.ok) {
          const content = await this.instantiateResource(response);
          resolve(content);
        } else {
          resolve(undefined);
        }
      } catch (_err) {
        // todo: log this?
        resolve(undefined);
      }
    });
  }

  protected async requestResource(container: CloudStorageContainerUrl, id: TContentId): Promise<Response> {
    const url = new URL(container.url, this.supplyUrlBase(container, id));

    if (!container.bound) {
      url.pathname += `/${this.formResourceName(id)}`;
    }

    const init: RequestInit = {
      headers: container.headers,
      method: "GET",
    };

    return fetch(url.toString(), init);
  }

  private _pendingContainerRequests: Map<string, Promise<CloudStorageContainerUrl>> = new Map();

  protected async getContainer(id: TContentId): Promise<CloudStorageContainerUrl> {
    const now = new Date().getTime();
    const name = this.formContainerName(id);
    const resource = this.formResourceName(id);
    const key = this.formContainerKey(id);

    let container = this._containers.get(key);
    if (container && container.url && (container.valid > now || container.expires < now)) {
      container = undefined;
      this._containers.delete(key);
    }

    if (!container) {
      let request = this._pendingContainerRequests.get(key);
      if (!request) {
        request = new Promise(async (resolve, reject) => {
          try {
            container = await this.obtainContainerUrl(id, { name, resource });
            this._containers.set(key, container);
            this._pendingContainerRequests.delete(key);
            resolve(container);
          } catch (err) {
            this._pendingContainerRequests.delete(key);
            reject(err);
          }
        });

        this._pendingContainerRequests.set(key, request);
      }

      return request;
    }

    return Promise.resolve(container);
  }
}
