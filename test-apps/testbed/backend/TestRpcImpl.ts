/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { TestRpcInterface, TestOp1Params, TestRpcInterface2, TestRpcInterface3, TestNotFoundResponse, TestNotFoundResponseCode } from "../common/TestRpcInterface";
import { RpcInterface, RpcManager, RpcRequest, RpcOperationsProfile, RpcPendingResponse, IModelToken, RpcInvocation } from "@bentley/imodeljs-common";
import { BentleyError, BentleyStatus, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { BriefcaseManager, ChangeSummaryManager, ChangeSummaryExtractOptions, IModelDb, IModelJsFs } from "@bentley/imodeljs-backend";
import { AccessToken } from "@bentley/imodeljs-clients";
import { testInterfaceResource } from "../common/TestbedConfig";

let op8Initializer = 0;

export const resetOp8Initializer = () => {
    op8Initializer = 0;
};

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
    public static register() {
        RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
    }

    public async op1(params: TestOp1Params): Promise<number> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const sum = params.sum();
        return sum;
    }

    public async op2(id: Id64): Promise<Id64> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = id;
        return val;
    }

    public async op3(date: Date): Promise<Date> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = date;
        return val;
    }

    public async op4(map: Map<any, any>): Promise<Map<any, any>> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = map;
        return val;
    }

    public async op5(set: Set<any>): Promise<Set<any>> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = set;
        return val;
    }

    public async op6(data: { x: number, y: number }): Promise<{ x: number, y: number }> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = data;
        return val;
    }

    public async op7(): Promise<RpcOperationsProfile> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = RpcRequest.aggregateLoad;
        return val;
    }

    public async op8(x: number, y: number): Promise<{ initializer: number; sum: number }> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        if (!op8Initializer) {
            op8Initializer = TestRpcInterface.OP8_INITIALIZER;
            throw new RpcPendingResponse(TestRpcInterface.OP8_PENDING_MESSAGE);
        } else {
            const val = { initializer: op8Initializer, sum: x + y };
            return val;
        }
    }

    public async extractChangeSummaries(accessToken: AccessToken, iModelToken: IModelToken, options: any): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        await ChangeSummaryManager.extractChangeSummaries(activityContext, accessToken, IModelDb.find(iModelToken), options as ChangeSummaryExtractOptions);
    }

    public async deleteChangeCache(iModelToken: IModelToken): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        if (!iModelToken.iModelId)
            throw new Error("iModelToken is invalid. Must not be a standalone iModel");

        const changesPath: string = BriefcaseManager.getChangeCachePathName(iModelToken.iModelId);
        if (IModelJsFs.existsSync(changesPath))
            IModelJsFs.unlinkSync(changesPath);
    }

    public async op9(requestId: string): Promise<string> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const invocation = RpcInvocation.current(this);
        if (!invocation || invocation.request.id !== requestId)
            throw new Error();

        const val = requestId;
        return val;
    }

    public async op10(): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        activityContext;
        throw new BentleyError(BentleyStatus.ERROR);
    }

    public async op11(input: string, call: number): Promise<string> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        if (input === "oldvalue") {
            throw new TestNotFoundResponse(TestNotFoundResponseCode.CanRecover);
        } else if (input === "newvalue") {
            if (call === 1) {
                throw new TestNotFoundResponse(TestNotFoundResponseCode.Fatal);
            } else {
                const val = input;
                return val;
            }
        } else {
            throw new Error("Invalid.");
        }
    }

    public async op12(): Promise<Uint8Array> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = testInterfaceResource();
        return val;
    }

    public async op13(data: Uint8Array): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        if (data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 4) {
            return;
        } else {
            throw new Error();
        }
    }
}

export class TestRpcImpl2 extends RpcInterface implements TestRpcInterface2 {
    public static register() {
        RpcManager.registerImpl(TestRpcInterface2, TestRpcImpl2);
    }

    public static unregister() {
        RpcManager.unregisterImpl(TestRpcInterface2);
    }

    public static instantiate() {
        // Demonstrates how a consumer can create and supply an instance of the RPC implementation class if necessary.
        const instance = new TestRpcImpl2();
        RpcManager.supplyImplInstance(TestRpcInterface2, instance);
    }

    public async op1(input: number): Promise<number> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = input;
        return val;
    }
}

export class TestRpcImpl3 extends RpcInterface implements TestRpcInterface3 {
    public static register() {
        RpcManager.registerImpl(TestRpcInterface3, TestRpcImpl3);
    }

    public async op1(input: number): Promise<number> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const val = input;
        return val;
    }
}
