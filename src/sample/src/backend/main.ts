// tslint:disable:no-var-requires
import { app } from "electron";

// Load my application backend code
require("./MyAppBackend");

if (app) {
  require("./electron/ElectronMain");
} else {
  require("./web/WebServer");
}
