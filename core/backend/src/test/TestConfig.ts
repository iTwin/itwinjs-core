
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

export class TestConfig {
  public static get email(): string { return Config.App.get("imjs_test_regular_user_name"); }
  public static get password(): string { return Config.App.get("imjs_test_regular_user_password"); }
  public static get projectName(): string { return Config.App.get("imjs_test_project_name"); }
  public static get iModelName(): string { return Config.App.get("imjs_test_imodel_name"); }
}
