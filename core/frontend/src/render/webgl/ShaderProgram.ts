/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";

export const enum CompileStatus {
  Success,
  Failure,
  Uncompiled,
}

export class ShaderProgram {
  private _description: string;
  private _vertSource: string;
  private _fragSource: string;
  private _glId: number = 0;
  private _inUse: boolean = false;
  private _status: CompileStatus = CompileStatus.Uncompiled;

  public constructor(vertSource: string, fragSource: string, description: string) {
    this._description = description;
    this._vertSource = vertSource;
    this._fragSource = fragSource;

    // ###TODO: Silencing 'unused variable' warnings temporarily...
    assert(undefined !== this._description);
    assert(undefined !== this._vertSource);
    assert(undefined !== this._fragSource);
    assert(0 === this._glId);
    assert(!this._inUse);
    assert(CompileStatus.Uncompiled === this._status);
  }
}
