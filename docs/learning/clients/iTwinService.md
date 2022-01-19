# Bentley iTwin Service

Bentley's iTwin Service is a cloud subscription program for managing Infrastructure Digital Twins. An iTwin subscription includes services for visualizing, managing and securing a single digital twin, including its reality data and iModels, along with federated project and/or asset data. iTwin services include tools for granting (and revoking) role-based authorization to access digital twins and services.

## iTwin.js and iTwin Subscriptions

[Please see the discussion](../backend/AccessingIModels.md) of the rules for accessing iModels and the description of Snapshot iModels.

Whenever an iTwin.js-based program attempts to open a **non-Snapshot** iModel, it must supply:

1. The verified identity of the user
1. The identity of the application

Internally, iTwin.js will check that the owner of the iModel has granted access for that combination. Otherwise the access is denied. An iTwin subscription is Bentley's commercial model for providing the mechanism for managing users, applications, and services for iModels.

## Third party iTwin.js Applications and Services

Third party developers are free to create applications and services using the iTwin.js libraries. They may distribute, license, execute, and charge for those applications in any way they choose. Doing so does not require any license or permissions from Bentley. iTwin.js based applications may run on any cloud computing environment, any desktop, or any mobile device. However, *when those applications run* on a non-Snapshot iModel, they will check that the *target iModel's owner* has a valid Bentley iTwin subscription and has granted permission for the program and user. Note that the right-to-run is a contract between Bentley and the iTwin subscriber, to which the iTwin.js application author is not a party.

## Self-hosting iTwin Services

iTwin is a set of cloud services, hosted by Bentley globally in Microsoft Azure. Certain user organizations and third party developers may wish to supply some or all of those services themselves. The ability to do that is not part of the iTwin.js libraries, but is available under a separate license agreement from Bentley. Please contact us if you are interested to learn more.

## OEM iTwin Providers

In certain cases, Bentley may delegate the ability to provide, administer, and enforce the iTwin subscription contract to third party OEMs. In this case, the rules above still apply, but the right-to-run is granted by the OEM under a contract with Bentley.
