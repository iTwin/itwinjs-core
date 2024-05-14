import { expect } from "chai";
import { SinonStub, stub } from "sinon";
import { Readable, Writable } from "stream";
import { HttpServerRequest, HttpServerResponse, RpcRequestFulfillment, RpcRequestStatus, SerializedRpcRequest, WebAppRpcProtocol } from "@itwin/core-common";
import { sendResponse } from "../../rpc/web/response";
import { brotliDecompressSync, unzipSync } from "node:zlib";

/* eslint-disable deprecation/deprecation */

class StubResponse extends Writable implements HttpServerResponse {
  public chunks: any[] = [];
  public get buffer(): Buffer { return Buffer.concat(this.chunks); }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public override _write(chunk: any, _encoding: BufferEncoding, callback: VoidFunction): void {
    this.chunks.push(chunk);
    callback();
  }

  public send: SinonStub<any[], HttpServerResponse> = stub().returns(this);
  public status: SinonStub<[number], HttpServerResponse> = stub();
  public set: SinonStub<[string, string], void> = stub();
}

describe("sendResponse", () => {
  let protocol: WebAppRpcProtocol;
  let request: SerializedRpcRequest;
  let fulfillment: RpcRequestFulfillment;
  let req: HttpServerRequest;
  let res: StubResponse;

  beforeEach(() => {
    protocol = { getStatus: () => RpcRequestStatus.Resolved } as any;
    request = { operation: { operationName: "fake-RPC-operation" } } as any;
    fulfillment = {
      allowCompression: true,
      status: 200,
      result: {
        data: [],
      },
    } as any;
    req = { header: () => "gzip, deflate, br" } as any;
    res = new StubResponse();
  });

  it("should compress response using Brotli", async () => {
    // Arrange
    const originalData = generateJson();
    const originalDataSize = Buffer.byteLength(originalData);
    fulfillment.result.objects = originalData;

    // Act
    await sendResponse(protocol, request, fulfillment, req, res);

    // Assert
    expect(res.set.calledWithExactly("Content-Encoding", "br")).to.be.true;

    const compressedData = res.send.getCall(0).args[0];
    expect(compressedData).to.not.be.undefined;
    expect(compressedData.length).to.be.lessThan(originalDataSize);
    expect(brotliDecompressSync(compressedData).toString()).to.be.equal(originalData);
  });

  it("should compress response using Gzip if Brotli is not supported", async () => {
    // Arrange
    const originalData = generateJson();
    const originalDataSize = Buffer.byteLength(originalData);
    fulfillment.result.objects = originalData;
    req.header = () => "gzip, deflate";

    // Act
    await sendResponse(protocol, request, fulfillment, req, res);

    // Assert
    expect(res.set.calledWithExactly("Content-Encoding", "gzip")).to.be.true;

    const compressedData = res.send.getCall(0).args[0];
    expect(compressedData).to.not.be.undefined;
    expect(compressedData.length).to.be.lessThan(originalDataSize);
    expect(unzipSync(compressedData).toString()).to.be.equal(originalData);
  });

  it("should not compress if Brotli and Gzip is not supported", async () => {
    // Arrange
    const originalData = generateJson();
    fulfillment.result.objects = originalData;
    req.header = () => undefined;

    // Act
    await sendResponse(protocol, request, fulfillment, req, res);

    // Assert
    expect(res.set.calledWithMatch("Content-Encoding")).to.be.false;

    expect(res.send.getCall(0).args[0]).to.be.equal(originalData);
  });

  it("should compress stream", async () => {
    // Arrange
    const originalData = generateJson();
    const originalDataSize = Buffer.byteLength(originalData);
    fulfillment.result.stream = Readable.from(originalData);

    // Act
    await sendResponse(protocol, request, fulfillment, req, res);
    await new Promise((resolve) => res.on("finish", resolve));

    // Assert
    const compressedData = res.buffer;
    expect(compressedData).to.not.be.undefined;
    expect(compressedData.length).to.be.lessThan(originalDataSize);
    expect(brotliDecompressSync(compressedData).toString()).to.be.equal(originalData);
  });
});

function generateJson(minimumSize = 2000): string {
  let propertyIdx = 0;
  const obj = {} as any;

  while (JSON.stringify(obj).length < minimumSize) {
    obj[`property-${propertyIdx}`] = `value-${propertyIdx}`;
    propertyIdx++;
  }

  return JSON.stringify(obj);
}
