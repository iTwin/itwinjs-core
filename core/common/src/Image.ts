/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** format of an image buffer */
export const enum ImageBufferFormat { Rgba = 0, Rgb = 2, Alpha = 5 }

/** format of an image */
export const enum ImageSourceFormat { Jpeg = 0, Png = 2 }

/** is image is stored bottom-up or top-up? This determines whether the rows should be flipped top-to-bottom */
export const enum BottomUp { No = 0, Yes = 1 }
