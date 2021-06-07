/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// this file is imported by the ts program in the prelude of the rule unit tests

export class ClientRequestContext {
  enter() {}
}

export class AuthorizedClientRequestContext extends ClientRequestContext {
}
