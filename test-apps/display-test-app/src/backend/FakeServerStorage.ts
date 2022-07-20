/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { BaseDirectory, Metadata, MultipartUploadData, MultipartUploadOptions, ObjectDirectory, ObjectProperties, ObjectReference, ServerStorage, TransferConfig, TransferData, TransferType } from "@itwin/object-storage-core";
import { Readable } from "stream";
import { createReadStream } from "fs";

async function readableToBuffer(readable: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks = Array<Uint8Array>();
    readable.on("data", (data) =>
      chunks.push(data instanceof Buffer ? data : Buffer.from(data))
    );
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

export class FakeServerStorage extends ServerStorage {
  public constructor(
    private readonly _dirname: string,
    private readonly _staticFilesUrl: string
  ) {
    super();
    fs.ensureDirSync(this._dirname);
  }

  private baseDirectoryToPath(dir: BaseDirectory): string {
    return path.join(this._dirname, dir.baseDirectory);
  }
  private objectDirectoryToPath(dir: ObjectDirectory): string {
    return dir.baseDirectory;
  }
  private objectReferenceToPath(ref: ObjectReference): string {
    return ref.relativeDirectory
      ? path.join(this._dirname, ref.baseDirectory, ref.relativeDirectory, ref.objectName)
      : path.join(this._dirname, ref.baseDirectory, ref.objectName);
  }

  public async download(reference: ObjectReference, transferType: "buffer"): Promise<Buffer>;
  public async download(reference: ObjectReference, transferType: "stream"): Promise<Readable>;
  public async download(reference: ObjectReference, transferType: "local", localPath?: string): Promise<string>;
  public async download(reference: ObjectReference, transferType: TransferType, _localPath?: string): Promise<TransferData | undefined> {
    const filePath = this.objectReferenceToPath(reference);
    if(!fs.existsSync(filePath))
      return undefined;
    if(transferType === "local")
      return filePath;
    const fileStream = createReadStream(filePath);
    switch(transferType) {
      case "buffer":
        return readableToBuffer(fileStream);
      case "stream":
        return fileStream;
      default:
        throw new Error(`Unsupported transferType "${transferType}"`);
    }
  }

  public async upload(reference: ObjectReference, data: TransferData, _metadata?: Metadata): Promise<void> {
    const filePath = this.objectReferenceToPath(reference);
    const dirPath = path.normalize(path.join(filePath, ".."));

    let dataToWrite: Uint8Array;
    if(data instanceof Buffer)
      dataToWrite = data;
    else if(data instanceof Readable)
      dataToWrite = await readableToBuffer(data);
    else
      dataToWrite = await readableToBuffer(createReadStream(data));

    await fs.ensureDir(dirPath);
    return fs.writeFile(filePath, dataToWrite);
  }

  public async uploadInMultipleParts(reference: ObjectReference, data: MultipartUploadData, _options?: MultipartUploadOptions): Promise<void> {
    return this.upload(reference, data);
  }

  public async createBaseDirectory(directory: BaseDirectory): Promise<void> {
    return fs.ensureDir(this.baseDirectoryToPath(directory));
  }

  public async list(_directory: BaseDirectory): Promise<ObjectReference[]> {
    throw new Error("Method not implemented.");
  }

  public async deleteBaseDirectory(directory: BaseDirectory): Promise<void> {
    return fs.remove(this.baseDirectoryToPath(directory));
  }

  public async deleteObject(reference: ObjectReference): Promise<void> {
    return fs.remove(this.objectReferenceToPath(reference));
  }

  public async baseDirectoryExists(directory: BaseDirectory): Promise<boolean> {
    return fs.pathExists(this.baseDirectoryToPath(directory));
  }

  public async objectExists(reference: ObjectReference): Promise<boolean> {
    return fs.pathExists(this.objectReferenceToPath(reference));
  }

  public async updateMetadata(_reference: ObjectReference, _metadata: Metadata): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async getObjectProperties(_reference: ObjectReference): Promise<ObjectProperties> {
    throw new Error("Method not implemented.");
  }

  public async getDownloadUrl(reference: ObjectReference, _expiresInSeconds?: number): Promise<string> {
    return `${this._staticFilesUrl}/${this.objectReferenceToPath(reference)}`;
  }

  public async getUploadUrl(_reference: ObjectReference, _expiresInSeconds?: number): Promise<string> {
    throw new Error("Method not implemented.");
  }

  public async getDownloadConfig(directory: ObjectDirectory, expiresInSeconds?: number): Promise<TransferConfig> {
    return {
      baseUrl: `${this._staticFilesUrl}/${this.objectDirectoryToPath(directory)}`,
      expiration: new Date(new Date().getTime() + 1000*(expiresInSeconds ?? 60*60)),
    };
  }

  public async getUploadConfig(_directory: ObjectDirectory, _expiresInSeconds?: number | undefined): Promise<TransferConfig> {
    throw new Error("Method not implemented.");
  }

  public async releaseResources(): Promise<void> { }
}
