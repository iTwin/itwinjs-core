/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Code, CodeState, MultiCode } from "../../imodelhub/Codes";
import { ResponseBuilder, RequestType } from "../ResponseBuilder";
import { ECJsonTypeMap } from "../../ECJsonTypeMap";

export function randomCodeValue(prefix: string): string {
    return (prefix +  Math.floor(Math.random() * Math.pow(2, 30)).toString());
  }

export  function randomCode(briefcase: number): Code {
    const code = new Code();
    code.briefcaseId = briefcase;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.value = randomCodeValue("TestCode");
    return code;
  }

/** assumes all have same scope / specId */
export function mockUpdateCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
  }

/** assumes all have same scope / specId */
export function mockDeniedCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateError("iModelHub.CodeReservedByAnotherBriefcase", "", "", new Map<string, any>([["ConflictingCodes", JSON.stringify(codes.map((value) => {
      const obj = ECJsonTypeMap.toJson<Code>("wsg", value);
      return obj.properties;
    })),
    ]]));
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
  }
