/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "./../Request";
import { Config } from "../Config";
import { DefaultRequestOptionsProvider } from "../index";

export class EventBaseHandler {
  /** Gets service bus parser depending on the environment. */
  protected setServiceBusOptions(options: RequestOptions) {
    const parse: (str: string) => any = (message: string) => JSON.parse(message.substring(message.indexOf("{"), message.lastIndexOf("}") + 1));

    if (Config.isBrowser()) {
      options.parser = (_: any, message: any) => parse(message);
    } else {
      options.buffer = true;
      options.parser = (res: any, cb: any) => {
        res.on("data", (chunk: any) => { res.text += chunk; });
        res.on("end", () => {
          try {
            cb(null, parse(res.text));
          } catch (err) {
            cb(err, null);
          }
        });
      };
    }
  }

  /**
   * Gets event from Service Bus Topic.
   * @param sasToken Service Bus SAS Token.
   * @return Event if it exists.
   */
  protected getEventRequestOptions(sasToken: string): RequestOptions {
    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: sasToken },
    };

    new DefaultRequestOptionsProvider().assignOptions(options);

    this.setServiceBusOptions(options);

    return options;
  }

}
