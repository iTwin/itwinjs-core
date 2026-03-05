/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { type ChildProcess, spawn } from "child_process";
import { emptyDirSync, mkdirsSync } from "fs-extra";
import { join } from "path";
import * as net from "net";
import * as azureBlob from "@azure/storage-blob";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { BlobContainer } from "../BlobContainerService";
import { CloudSqlite } from "../CloudSqlite";
import { IModelHost } from "../IModelHost";
import { SettingsContainer } from "../workspace/Settings";

// spell:ignore imodelid itwinid mkdirs devstoreaccount racwdl

export namespace TestAzuriteHelper {
  export const storageType = "azure";
  export const httpAddr = "127.0.0.1:10002";
  export const accountName = "devstoreaccount1";
  export const baseUri = `http://${httpAddr}/${accountName}`;

  const azuriteStorageDir = join(__dirname, "azuriteStorage");
  const azuriteHost = "127.0.0.1";
  const azuritePort = 10002;
  let azuriteProcess: ChildProcess | undefined;
  let ownsAzuriteProcess = false;
  let savedBlobContainerService: BlobContainer.ContainerService | undefined;
  let savedAuthorizationClient = IModelHost.authorizationClient;

  export const getContainerUri = (id: string) => `${baseUri}/${id}`;
  // Azurite devstoreaccount1 fake key for local test emulation only.
  const pipeline = azureBlob.newPipeline(new azureBlob.StorageSharedKeyCredential(accountName, "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="));
  export const createAzClient = (id: string) => new azureBlob.ContainerClient(getContainerUri(id), pipeline);

  export let userToken: AccessToken;
  export class AuthorizationClient {
    public async getAccessToken(): Promise<string> {
      return userToken;
    }
  }

  async function isPortOpen(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  }

  async function waitForPort(host: string, port: number, timeoutMs = 15000): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await isPortOpen(host, port))
        return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for Azurite at ${host}:${port}`);
  }

  async function startAzuriteIfNeeded(): Promise<void> {
    if (await isPortOpen(azuriteHost, azuritePort)) {
      ownsAzuriteProcess = false;
      return;
    }

    mkdirsSync(azuriteStorageDir);
    emptyDirSync(azuriteStorageDir);
    azuriteProcess = spawn("azurite-blob", ["--blobPort", `${azuritePort}`, "--silent", "--loose", "--location", azuriteStorageDir], {
      stdio: "ignore",
      shell: true,
    });
    ownsAzuriteProcess = true;
    await waitForPort(azuriteHost, azuritePort);
  }

  async function stopAzuriteIfOwned(): Promise<void> {
    if (!ownsAzuriteProcess || !azuriteProcess)
      return;

    const process = azuriteProcess;
    let exited = false;
    await new Promise<void>((resolve) => {
      process.once("exit", () => {
        exited = true;
        resolve();
      });

      process.kill("SIGTERM");
      setTimeout(() => {
        if (exited)
          return;

        process.kill("SIGKILL");
        setTimeout(resolve, 2000);
      }, 3000);
    });

    azuriteProcess = undefined;
    ownsAzuriteProcess = false;

    if (await isPortOpen(azuriteHost, azuritePort))
      throw new Error(`Failed to stop Azurite at ${azuriteHost}:${azuritePort}`);
  }

  export namespace Sqlite {
    export type TestContainer = CloudSqlite.CloudContainer;

    export const setSasToken = async (container: CloudSqlite.CloudContainer, accessLevel: BlobContainer.RequestAccessLevel) => {
      container.accessToken = await CloudSqlite.requestToken({ containerId: container.containerId, accessLevel });
    };

    export const createAzContainer = async (container: { containerId: string, isPublic?: boolean }) => {
      const containerId = container.containerId ?? Guid.createValue();
      const createProps: BlobContainer.CreateNewContainerProps = {
        metadata: {
          label: "Test Container",
          description: "CloudSqlite container for tests",
          containerType: "cloud-sqlite",
          json: { blockSize: "64K" },
        },
        containerId,
        scope: {
          iTwinId: "itwin-for-tests",
        },
        userToken: service.userToken.admin,
      };

      if (container.isPublic)
        (createProps as any).isPublic = true; // just for tests.

      const containerService = BlobContainer.service;
      if (undefined === containerService)
        throw new Error("BlobContainer service is not initialized");
      try {
        await containerService.delete({ containerId, baseUri, userToken: createProps.userToken });
      } catch { }

      return containerService.create(createProps);
    };

    export interface TestContainerProps { containerId: string, logId?: string, isPublic?: boolean, writeable?: boolean }

    export const makeContainer = async (arg: TestContainerProps): Promise<TestContainer> => {
      const containerProps = { ...arg, writeable: true, baseUri, storageType } as const;
      const accessToken = await CloudSqlite.requestToken(containerProps);
      return CloudSqlite.createCloudContainer({ ...containerProps, accessToken });
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

      const address = { containerId: arg.containerId ?? Guid.createValue(), baseUri, provider: storageType } as const;
      const azCont = createAzClient(address.containerId);
      const opts: azureBlob.ContainerCreateOptions = {
        metadata: {
          itwinid: arg.scope.iTwinId,
          containertype: arg.metadata.containerType,
          label: arg.metadata.label,
        },
      };
      const metadata = opts.metadata ?? (opts.metadata = {});
      if (arg.scope.iModelId)
        metadata.imodelid = arg.scope.iModelId;
      if (arg.scope.ownerGuid)
        metadata.ownerguid = arg.scope.ownerGuid;
      if (arg.metadata.description)
        metadata.description = arg.metadata.description;
      if (arg.metadata.json)
        metadata.json = JSON.stringify(arg.metadata.json);

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
      const metadata = (await createAzClient(container.containerId).getProperties()).metadata;
      if (undefined === metadata)
        throw new Error("container metadata is undefined");
      return {
        iTwinId: metadata.itwinid,
        iModelId: metadata.imodelid,
        ownerGuid: metadata.ownerguid,
      };
    },
    queryContainersMetadata: async (_userToken: AccessToken, _args: BlobContainer.QueryContainerProps): Promise<BlobContainer.MetadataResponse[]> => {
      throw new Error("Querying containers not supported in this test service");
    },
    queryMetadata: async (container: BlobContainer.AccessContainerProps): Promise<BlobContainer.Metadata> => {
      const metadata = (await createAzClient(container.containerId).getProperties()).metadata;
      if (undefined === metadata)
        throw new Error("container metadata is undefined");
      return {
        containerType: metadata.containertype,
        label: metadata.label,
        description: metadata.description,
        json: metadata.json ? JSON.parse(metadata.json) : undefined,
      };
    },
    updateJson: async (container: BlobContainer.AccessContainerProps, props: SettingsContainer): Promise<void> => {
      const client = createAzClient(container.containerId);
      const metadata = (await client.getProperties()).metadata;
      if (undefined === metadata)
        throw new Error("container metadata is undefined");
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
        baseUri,
      };
    },
  };

  export async function setup(): Promise<void> {
    await startAzuriteIfNeeded();
    savedBlobContainerService = BlobContainer.service;
    savedAuthorizationClient = IModelHost.authorizationClient;
    try {
      BlobContainer.service = service;
      IModelHost.authorizationClient = new AuthorizationClient();
      userToken = service.userToken.admin;
    } catch (err) {
      IModelHost.authorizationClient = savedAuthorizationClient;
      BlobContainer.service = savedBlobContainerService;
      await stopAzuriteIfOwned();
      throw err;
    }
  }

  export async function teardown(): Promise<void> {
    IModelHost.authorizationClient = savedAuthorizationClient;
    BlobContainer.service = savedBlobContainerService;
    await stopAzuriteIfOwned();
  }
}
