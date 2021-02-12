/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface Contexts {
  org: string;
  application: string;
  context: string;
  imodel: string;
}

export interface Document {
  id: string;
  briefcaseId: number;
}

export interface Properties {
  version: number;
  documents: Document[];
}

export interface DocumentMapping {
  id: string;
  name: string;
  namespace: string;
  contexts: Contexts;
  properties: Properties;
  ts: number;
}

export interface Result<T> {
  statusCode: number;
  value: T;
}
