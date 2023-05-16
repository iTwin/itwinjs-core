/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { emptyDirSync, mkdirsSync } from "fs-extra";
import { join } from "path";
import * as azureBlob from "@azure/storage-blob";
import { BlobContainer, CloudSqlite, IModelHost } from "@itwin/core-backend";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// spell:ignore imodelid itwinid mkdirs devstoreaccount racwdl

export namespace AzuriteTest {

  export const storageType = "azure";
  export const httpAddr = "127.0.0.1:10000";
  export const accountName = "devstoreaccount1";
  export const baseUri = `http://${httpAddr}/${accountName}`;

  export const getContainerUri = (id: string) => `${baseUri}/${id}`;
  const pipeline = azureBlob.newPipeline(new azureBlob.StorageSharedKeyCredential(accountName, "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="));
  export const createAzClient = (id: string) => new azureBlob.ContainerClient(getContainerUri(id), pipeline);

  export let userToken: AccessToken;
  export class AuthorizationClient {
    public async getAccessToken(): Promise<string> {
      return userToken;
    }
  }
  export namespace Sqlite {
    export type TestContainer = CloudSqlite.CloudContainer;

    export const setSasToken = async (container: CloudSqlite.CloudContainer, requestWriteAccess: boolean) => {
      container.accessToken = await CloudSqlite.requestToken({ baseUri, containerId: container.containerId, storageType, writeable: requestWriteAccess });
    };

    export const createAzContainer = async (container: { containerId: string, isPublic?: boolean }) => {
      const createProps: BlobContainer.CreateNewContainerProps = {
        metadata: {
          application: IModelHost.applicationId,
          description: "CloudSqlite container for tests",
          format: "CloudSqlite",
          blockSize: "64K",
        },
        id: container.containerId ?? Guid.createValue(),
        scope: {
          iTwinId: "itwin-for-tests",
        },
        userToken: service.userToken.admin,
      };

      if (container.isPublic)
        (createProps as any).isPublic = true; // just for tests.

      const containerService = BlobContainer.service!;
      try {
        await containerService.delete({ address: { id: createProps.id!, baseUri }, userToken: createProps.userToken });
      } catch (e) {
      }

      return containerService.create(createProps);
    };

    export const initializeContainers = (containers: TestContainer[]) => {
      for (const container of containers) {
        container.initializeContainer({ checksumBlockNames: true, blockSize: 64 * 1024 });
      }
    };
    export const makeEmptyDir = (name: LocalDirName) => {
      mkdirsSync(name);
      emptyDirSync(name);
    };

    export interface TestContainerProps { containerId: string, logId?: string, isPublic?: boolean, writeable?: boolean }

    export const makeContainer = async (arg: TestContainerProps): Promise<TestContainer> => {
      const containerProps: CloudSqlite.ContainerTokenProps = { ...arg, writeable: true, baseUri, storageType };
      const accessToken = await CloudSqlite.requestToken(containerProps);
      return CloudSqlite.createCloudContainer({ ...containerProps, accessToken });
    };

    export const createContainers = async (props: TestContainerProps[]): Promise<TestContainer[]> => {
      const containers = [];
      for (const entry of props) {
        await createAzContainer(entry);
        containers.push(await makeContainer(entry));
      }

      return containers;
    };
    export const makeCache = (cacheName: string) => {
      const cacheDir = join(IModelHost.cacheDir, cacheName);
      makeEmptyDir(cacheDir);
      return CloudSqlite.CloudCaches.getCache({ cacheName, cacheDir });

    };
    export const makeCaches = (names: string[]) => {
      const caches = [];
      for (const name of names)
        caches.push(makeCache(name));
      return caches;
    };

    export const uploadFile = async (container: CloudSqlite.CloudContainer, cache: CloudSqlite.CloudCache, dbName: string, localFileName: LocalFileName) => {
      expect(container.isConnected).false;
      container.connect(cache);
      expect(container.isConnected);

      await CloudSqlite.withWriteLock("upload", container, async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
      expect(container.isConnected);
      container.disconnect({ detach: true });
      expect(container.isConnected).false;
    };
  }

  const fakeUser = () => `token ${Guid.createValue()}`;
  export const service: BlobContainer.ContainerService & { userToken: { admin: string, readOnly: string, readWrite: string } } = {
    userToken: {
      admin: fakeUser(), // just unique strings
      readOnly: fakeUser(),
      readWrite: fakeUser(),
    },

    create: async (arg: BlobContainer.CreateNewContainerProps & { isPublic?: true }) => {
      if (arg.userToken !== service.userToken.admin)
        throw new Error("only admins may create containers");

      const address = { id: arg.id ?? Guid.createValue(), baseUri };
      const azCont = createAzClient(address.id);
      const opts: azureBlob.ContainerCreateOptions = {
        metadata: {
          itwinid: arg.scope.iTwinId,
          ...arg.metadata,
        },
      };
      if (arg.scope.iModelId)
        opts.metadata!.imodelid = arg.scope.iModelId;
      if (arg.isPublic)
        opts.access = "blob";

      await azCont.create(opts);
      return address;
    },

    delete: async (arg: BlobContainer.AccessContainerProps): Promise<void> => {
      if (arg.userToken !== service.userToken.admin)
        throw new Error("only admins may delete containers");

      await createAzClient(arg.address.id).delete();
    },

    requestToken: async (arg: BlobContainer.RequestTokenProps): Promise<BlobContainer.TokenProps> => {
      switch (arg.userToken) {
        case service.userToken.admin:
        case service.userToken.readWrite:
          break;
        case service.userToken.readOnly:
          if (!arg.forWriteAccess)
            break;
        // eslint-disable-next-line no-fallthrough
        default:
          throw new Error("unauthorized user");
      }
      const azCont = createAzClient(arg.address.id);
      const startsOn = new Date();
      const expiresOn = new Date(startsOn.valueOf() + ((arg.durationSeconds ?? 12 * 60 * 60) * 1000));
      const permissions = azureBlob.ContainerSASPermissions.parse(arg.forWriteAccess ? "racwdl" : "rl");
      const sasUrl = await azCont.generateSasUrl({ permissions, startsOn, expiresOn });
      const contProps = await azCont.getProperties();
      const metadata = contProps.metadata as any;
      if (metadata?.itwinid === undefined)
        throw new Error("invalid container");

      return {
        scope: {
          iTwinId: metadata.itwinid,
          iModelId: metadata.imodelid,
        },
        metadata,
        token: sasUrl.split("?")[1],
        provider: "azure",
        expiration: expiresOn,
      };
    },
  };
  BlobContainer.service = service;
}
