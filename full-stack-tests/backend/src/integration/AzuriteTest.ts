/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as crypto from "crypto";
import * as fs from "fs";
import { emptyDirSync, mkdirsSync } from "fs-extra";
import { join } from "path";
import { open } from "sqlite";
import * as sqlite3 from "sqlite3";
import * as azureBlob from "@azure/storage-blob";
import { BlobContainer, CloudSqlite, IModelHost, KnownLocations, SettingsContainer } from "@itwin/core-backend";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// spell:ignore imodelid itwinid mkdirs devstoreaccount racwdl

export namespace AzuriteTest {

  export const storageType = "azure" as const;
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

    export const uploadDummyBlock = async (container: CloudSqlite.CloudContainer, blockNameSize: number): Promise<string> => {
      const generateRandomHexString = (length: number) => {
        const bytes = crypto.randomBytes(length);
        const hexString = bytes.toString("hex");
        return hexString.toUpperCase();
      };
      const azClient = createAzClient(container.containerId);
      const blockName = `${generateRandomHexString(blockNameSize)}.bcv`;
      const blobClient = azClient.getBlockBlobClient(blockName);
      await blobClient.uploadData(Buffer.alloc(0));
      return blockName;
    };

    export const checkBlockExists = async (container: CloudSqlite.CloudContainer, blockName: string): Promise<boolean> => {
      const azClient = createAzClient(container.containerId);
      const blobClient = azClient.getBlockBlobClient(blockName);
      return blobClient.exists();
    };

    export const overwriteWriteLockValue = async (container: CloudSqlite.CloudContainer, blockName: string) => {
      const azClient = createAzClient(container.containerId);
      const blobClient = azClient.getBlockBlobClient(blockName);
      const tempFilePath = join(KnownLocations.tmpdir, blockName);
      await blobClient.downloadToFile(tempFilePath);

      const bcv_kv = await open({
        filename: tempFilePath,
        driver: sqlite3.Database,
      });
      const row = await bcv_kv.get<{ v: string }>("SELECT v FROM kv WHERE k = 'writeLock'");
      if (row) {
        const writeLockData = JSON.parse(row.v);
        const expiresDate = new Date(writeLockData.expires);
        expiresDate.setMinutes(expiresDate.getMinutes() - 5);
        writeLockData.expires = expiresDate.toISOString();
        await bcv_kv.run("UPDATE kv SET v = ? WHERE k = 'writeLock'", JSON.stringify(writeLockData));
      }
      await bcv_kv.close();
      await blobClient.uploadFile(tempFilePath);
      fs.unlinkSync(tempFilePath);
    };

    export const setSasToken = async (container: CloudSqlite.CloudContainer, accessLevel: BlobContainer.RequestAccessLevel) => {
      container.accessToken = await CloudSqlite.requestToken({ baseUri, containerId: container.containerId, accessLevel });
    };

    export const createAzContainer = async (container: { containerId: string, isPublic?: boolean }) => {
      const createProps: BlobContainer.CreateNewContainerProps = {
        metadata: {
          label: "Test Container",
          description: "CloudSqlite container for tests",
          containerType: "cloud-sqlite",
          json: { blockSize: "64K" },
        },
        containerId: container.containerId ?? Guid.createValue(),
        scope: {
          iTwinId: "itwin-for-tests",
        },
        userToken: service.userToken.admin,
      };

      if (container.isPublic)
        (createProps as any).isPublic = true; // just for tests.

      const containerService = BlobContainer.service!;
      try {
        await containerService.delete({ containerId: createProps.containerId!, baseUri, userToken: createProps.userToken });
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

    export interface TestContainerProps { containerId: string, logId?: string, isPublic?: boolean, writeable?: boolean, lockExpireSeconds?: number}

    export const makeContainer = async (arg: TestContainerProps): Promise<TestContainer> => {
      const containerProps = { ...arg, writeable: true, baseUri, storageType };
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

      await CloudSqlite.withWriteLock({ user: "upload", container }, async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
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

      const address = { containerId: arg.containerId ?? Guid.createValue(), baseUri, provider: storageType };
      const azCont = createAzClient(address.containerId);
      const opts: azureBlob.ContainerCreateOptions = {
        metadata: {
          itwinid: arg.scope.iTwinId,
          containertype: arg.metadata.containerType,
          label: arg.metadata.label,
        },
      };
      if (arg.scope.iModelId)
        opts.metadata!.imodelid = arg.scope.iModelId;
      if (arg.scope.ownerGuid)
        opts.metadata!.ownerguid = arg.scope.ownerGuid;
      if (arg.metadata.description)
        opts.metadata!.description = arg.metadata.description;
      if (arg.metadata.json)
        opts.metadata!.json = JSON.stringify(arg.metadata.json);

      if (arg.isPublic)
        opts.access = "blob";

      await azCont.create(opts);
      return address;
    },

    delete: async (arg: BlobContainer.AccessContainerProps): Promise<void> => {
      if (arg.userToken !== service.userToken.admin)
        throw new Error("only admins may delete containers");

      await createAzClient(arg.containerId).delete();
    },
    queryScope: async (container: BlobContainer.AccessContainerProps): Promise<BlobContainer.Scope> => {
      const metadata = (await createAzClient(container.containerId).getProperties()).metadata!;
      return {
        iTwinId: metadata.itwinid,
        iModelId: metadata.imodelid,
        ownerGuid: metadata.ownerguid,
      };
    },
    queryMetadata: async (container: BlobContainer.AccessContainerProps): Promise<BlobContainer.Metadata> => {
      const metadata = (await createAzClient(container.containerId).getProperties()).metadata!;
      return {
        containerType: metadata.containertype,
        label: metadata.label,
        description: metadata.description,
        json: metadata.json ? JSON.parse(metadata.json) : undefined,
      };
    },
    updateJson: async (container: BlobContainer.AccessContainerProps, props: SettingsContainer): Promise<void> => {
      const client = createAzClient(container.containerId);
      const metadata = (await client.getProperties()).metadata!;
      metadata.json = JSON.stringify(props);
      await client.setMetadata(metadata);
    },
    requestToken: async (arg: BlobContainer.RequestTokenProps): Promise<BlobContainer.TokenProps> => {
      let accessLevel = arg.accessLevel;
      switch (arg.userToken) {
        case service.userToken.admin:
          break;
        case service.userToken.readWrite:
          if (accessLevel !== "admin")
            break;
          break;
        case service.userToken.readOnly:
          if (accessLevel === "read" || accessLevel === "writeIfPossible") {
            accessLevel = "read"; // simulate fail, then retry with no write access
            break;
          }
        // eslint-disable-next-line no-fallthrough
        default:
          throw new Error("unauthorized user");
      }
      const azCont = createAzClient(arg.containerId);
      const startsOn = new Date();
      const expiresOn = new Date(startsOn.valueOf() + ((arg.durationSeconds ?? 12 * 60 * 60) * 1000));
      const permissions = azureBlob.ContainerSASPermissions.parse(accessLevel === "read" ? "rl" : "racwdl");
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
