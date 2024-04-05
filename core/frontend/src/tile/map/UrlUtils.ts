/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export class UrlUtils {

  /** Append custom parameters for settings to provided URL object.
   *  Make sure custom parameters do no override query parameters already part of the URL (lower case comparison)
   * @internal
   */
  public static appendQueryParams(url: string, queryParams?: {[key: string]: string}) {
    if (!queryParams)
      return url;

    // create a lower-case array of keys
    const currentParams: string[] = [];
    const currentUrl = new URL(url);
    currentUrl.searchParams.forEach((_value, key, _parent) => {
      currentParams.push(key.toLowerCase());
    });

    const urlParamsFromIndexArray = (indexArray?: {[key: string]: string}, result?: URLSearchParams): URLSearchParams  => {
      const urlParams = (result ? result : new URLSearchParams());
      if (!indexArray)
        return urlParams;
      Object.keys(indexArray).forEach((key) => {
        if (!currentParams.includes(key.toLowerCase()))
          urlParams.append(key, indexArray[key]);
      });
      return urlParams;
    };

    const params = urlParamsFromIndexArray(queryParams);

    const getSeparator = (u: string) => {
      let separator = "&";
      if (u.includes("?")) {
        if (u.endsWith("?"))
          separator = "";
      } else {
        separator = "?";
      }
      return separator;
    };
    if ( params.size > 0) {
      url = `${url}${getSeparator(url)}${params.toString()}`;
    }

    return url;
  }
}
