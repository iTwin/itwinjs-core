# Registering applications

Your application must be registered with Bentley’s OpenId provider in order to access resources from Bentley services such as iModelHub. A registration identifies your application to other services and specifies what resources your application can access such as iModels, reality data, and user information, and more. All deployed applications must be registered.

There are three types:

##### [Web Application]($docs/learning/app.md/#interactive-apps)

An interactive application obtains information from an iModel and presents that information in a user interface.

##### [Agent Application]($docs/learning/app.md/#agents-and-services)

iModel agents and services are apps that have no interactive user interface.

##### [Desktop Application]($docs/learning/app.md/#desktop-apps)

An interactive application obtains information from an iModel and presents that information in a user interface. The app runs in Electron on the user's desktop.

**[Register apps here]($docs/registration-dashboard.md)**

1. Go to the [registration dashboard]($docs/getting-started/registration-dashboard/)
1. Click the "+ New App" button
1. Select the type of app you would like to register
1. Give your app a human readable name
1. Select the scopes your app will need
1. Specify the different redirect URIs for sign in and sign out
1. Click finish registration
   - If Agent application, the client's secret will be displayed one time only, save this secret in a secure location
1. The app's Client ID will appear in the Registered Apps grid
