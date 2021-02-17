# Saving and Retrieving Settings in iTwin.js

Applications frequently need to persist settings across sessions. Examples include user preferences; tool settings; recently accessed models, views, or projects; user interface state; etc. Some settings are application specific, some are Project specific, and some are iModel specific. Settings are often specific to a particular user, but in some cases defaults settings are established that are available to all users.

In theory, settings that are iModel-specific could be stored in the iModel itself, but in practice that is not optimal, because the transaction model for design data does not fit well with settings data, and it is undesirable to have to commit a new version of an iModel every time a setting is saved. Therefore, the Settings service described here should be used for those settings too.

## The SettingsAdmin class

iTwin.js provides the [SettingsAdmin]($product-settings-client) object, accessed through [IModelApp.settings]($frontend), for managing settings. The default implementation of the SettingsAdmin interface stores all settings to an iTwin cloud service, but other implementations are possible. The default implementation treats Settings like sensitive data, which can be accessed only by logged-in users with the appropriate permissions.

The methods on SettingsAdmin allow saving and retrieving settings that are either user-specific or for all users. Saving a setting that is not user-specific requires administrator privileges, and is stored as specific to the organization of the user. Any user that belongs to that organization can retrieve the setting.

User-specific settings can be:

- Specific to an application (for example, the user's particular application preferences)
- Specific to an application and Project (for example, the user's most recently opened iModel when using the application)
- Specific to an application and iModel (for example, the user's application-specific session data)
- Specific to a Project (for example, the user's list of favorite iModels in that project)
- Specific to an iModel (for example, the user's list of favorite views in that iModel)
- Specific only to the user (for example, a list of favorite applications)

Non-user-specific settings can be:

- Specific to an application (for example, default application preferences)
- Specific to an application and Project (for example, the default iModel for the project when the application is opened)
- Specific to an application and iModel (for example, the default views for the iModel when the application is opened)
- Specific to a Project (for example, a message of the day for all users of that Project)
- Specific to an iModel (for example, default basic preferences relevant to all applications)

To save a non-user-specific setting, administrative privileges are required. That makes such settings ideal for parameters that should be fixed per-iModel or per-Project by an administrator, and used by every user.

Shared settings are similar to Non-user-specific settings, except that they can be written or deleted without administrative privileges. That makes them ideal for settings like Named Clip volumes, where users want to be able to create and share clip volumes, and to see clip volumes that were created by other users. There are no shared settings that are dependent only on Application.

Settings are identified by a namespace, that is specified by the program but should be chosen to be unique, and a name that need only be unique within the namespace.

All settings are passed as objects to the SettingsAdmin methods, and persisted as JSON strings representing that object. The return value from the SettingsAdmin methods is a [SettingsResult]($product-settings-client), that contains a status property, an error message which might be populated with explanatory information if the status indicates an error, and the retrieved setting object for the settings retrieval methods.
