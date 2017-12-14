/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** An interface for disposable objects. Users of such objects should
 * call the dispose method when the object is not needed.
 */
export interface Disposable {
  dispose(): void;
}

/** A definition of function which may be called to dispose an object */
export type DisposeFunc = () => void;

class FuncDisposable implements Disposable {
  private _disposeFunc: () => void;
  constructor(disposeFunc: () => void) { this._disposeFunc = disposeFunc; }
  public dispose() { this._disposeFunc(); }
}

/** A list of disposable objects which itself is also disposable. */
export class DisposableList implements Disposable {
  private _disposables: Disposable[];
  private isDisposable(x: Disposable | DisposeFunc): x is Disposable {
    return (x as Disposable).dispose !== undefined;
  }
  public add(disposable: Disposable | DisposeFunc) {
    if (this.isDisposable(disposable))
      this._disposables.push(disposable);
    else
      this._disposables.push(new FuncDisposable(disposable));
  }
  public remove(disposable: Disposable): void {
    const idx = this._disposables.indexOf(disposable);
    if (-1 !== idx)
      this._disposables.splice(idx, 1);
  }
  public dispose(): void {
    for (const disposable of this._disposables)
      disposable.dispose();
  }
}
