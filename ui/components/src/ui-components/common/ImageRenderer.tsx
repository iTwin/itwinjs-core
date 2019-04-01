/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as React from "react";
import { WebFontIcon } from "@bentley/ui-core";
import { ImageFileFormat, Image, LoadedBinaryImage, LoadedImage } from "./IImageLoader";

/** A class that renders images from data provided by an image loader
 * @internal
 */
export class ImageRenderer {
  private hexToBase64(hexstring: string) {
    const match = hexstring.match(/\w{2}/g);
    if (!match)
      return "";

    return btoa(match.map((a) => {
      return String.fromCharCode(parseInt(a, 16));
    }).join(""));
  }

  /** Render raw binary image */
  private renderBinary(data: string, format: ImageFileFormat) {
    // Convert binary to base64
    const dataAsBase64 = this.hexToBase64(data);
    return (<img src={`data:image/${format};base64,${dataAsBase64}`} />);
  }

  /** Render svg string into JSX */
  private renderSvg(svg: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");

    return (
      <div dangerouslySetInnerHTML={{ __html: doc.documentElement.outerHTML }} />
    );
  }

  /** Render image from an url */
  private renderUrl(url: string) {
    return (<img src={url} />);
  }

  /** Render image as ui-core icon */
  private renderCoreIcon(iconName: string) {
    return (<WebFontIcon iconName={iconName} />);
  }

  /** Render image from data provided by an image loader */
  public render(loadedImage: Image): React.ReactNode {
    switch (loadedImage.sourceType) {
      case "binary":
        const image = loadedImage as LoadedBinaryImage;
        return this.renderBinary(image.value, image.fileFormat);

      case "url":
        return this.renderUrl((loadedImage as LoadedImage).value);

      case "svg":
        return this.renderSvg((loadedImage as LoadedImage).value);

      case "core-icon":
        return this.renderCoreIcon((loadedImage as LoadedImage).value);

      default:
        throw new Error(`ImageRenderer: Can't handle sourceType: "${loadedImage.sourceType}"`);
    }
  }
}
