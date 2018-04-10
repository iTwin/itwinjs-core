// tslint:disable:no-var-requires
import { app as electron } from "electron";
import { Gateway } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";
import { ECPresentationGateway } from "@bentley/ecpresentation-backend";
import app from "./MyAppBackend";

if (electron) {
  require("./electron/ElectronMain");
} else {
  require("./web/WebServer");
}

// makes no sense, but we have to do this here because Gateways are registered as classes and not instances which we can set up
const ecpGateway = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition) as ECPresentationGateway;
ecpGateway.setManager(app.presentation);
