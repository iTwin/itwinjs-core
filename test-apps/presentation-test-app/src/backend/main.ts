// tslint:disable:no-var-requires
import { app as electron } from "electron";

require("./MyAppBackend");
if (electron) {
  require("./electron/ElectronMain");
} else {
  require("./web/WebServer");
}
