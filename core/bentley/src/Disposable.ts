/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/** An interface for disposable objects. Users of such objects should
 * call the dispose method when the object is not needed.
 */
export interface IDisposable {
  dispose(): void;
  isDisposed?(): boolean;
}

/**
 * A 'using' function which is a substitution for .NET's using statement. It makes sure that 'dispose'
 * is called on the resource no matter if the func returns or throws. If func returns, the return value
 * of this function is equal to return value of func. If func throws, this function also throws (after
 * disposing the resource).
 */
export function using<TDisposable extends IDisposable, TResult>(resources: TDisposable | TDisposable[], func: (...resources: TDisposable[]) => TResult): TResult {
  if (!Array.isArray(resources))
    return using([resources], func);

  const doDispose = () => resources.forEach((disposable) => disposable.dispose());
  let shouldDisposeImmediately = true;

  try {
    const result = func.apply(undefined, resources);
    if (result && result.then) {
      shouldDisposeImmediately = false;
      result.then(doDispose, doDispose);
    }
    return result;
  } finally {
    if (shouldDisposeImmediately)
      doDispose();
  }
}

/** A definition of function which may be called to dispose an object */
export type DisposeFunc = () => void;

class FuncDisposable implements IDisposable {
  private _disposeFunc: () => void;
  constructor(disposeFunc: () => void) { this._disposeFunc = disposeFunc; }
  public dispose() { this._disposeFunc(); }
}

/** A disposable container of disposable objects. */
export class DisposableList implements IDisposable {
  private _disposables: IDisposable[];

  /** Creates a disposable list. */
  constructor(disposables: Array<IDisposable | DisposeFunc> = []) {
    this._disposables = [];
    disposables.forEach((disposable) => {
      this.add(disposable);
    });
  }

  private isDisposable(x: IDisposable | DisposeFunc): x is IDisposable {
    return (x as IDisposable).dispose !== undefined;
  }

  /** Register an object for disposal. */
  public add(disposable: IDisposable | DisposeFunc) {
    if (this.isDisposable(disposable))
      this._disposables.push(disposable);
    else
      this._disposables.push(new FuncDisposable(disposable));
  }

  /** Unregister disposable object. */
  public remove(disposable: IDisposable): void {
    const idx = this._disposables.indexOf(disposable);
    if (-1 !== idx)
      this._disposables.splice(idx, 1);
  }

  /** Disposes all registered objects. */
  public dispose(): void {
    for (const disposable of this._disposables)
      disposable.dispose();
  }
}
