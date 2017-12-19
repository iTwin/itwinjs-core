/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export class ViewContext {
}

export class NullContext extends ViewContext {
}

export class SnapContext extends ViewContext {
}

export class RenderContext extends ViewContext {
}

export class DecorateContext extends RenderContext {
}
