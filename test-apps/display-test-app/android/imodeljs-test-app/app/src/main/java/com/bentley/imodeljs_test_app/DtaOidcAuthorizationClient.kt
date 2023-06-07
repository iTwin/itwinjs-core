/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultCaller
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.bentley.itwin.AuthTokenCompletionAction
import com.bentley.itwin.AuthorizationClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.openid.appauth.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.*
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * [AuthorizationClient] implementation that uses AppAuth-Android to present the login in a custom web browser tab.
 *
 * In order to use this, you must add a redirect scheme to the `defaultConfig` section of the `android` section
 * of your app's build.gradle. For example, something like this:
 *
 * ```
 *     manifestPlaceholders = ['appAuthRedirectScheme': 'com.bentley.sample.itwinstarter']
 * ```
 *
 * By using [ActivityResultCaller], the primary constructor is compatible with both [Fragment] and [ComponentActivity].
 */
open class DtaOidcAuthorizationClient(appContext: Context, configData: JSONObject) : AuthorizationClient() {
    private data class DtaAuthSettings(val issuerUri: Uri, val clientId: String, val redirectUri: Uri, val scope: String)
    private data class AccessToken(val token: String? = null, val expirationDate: String? = null)

    /**
     * Whether or not to use `setPrompt("login")` on the OIDC authorization request.
     *
     * By default, this is set to `true` in `init` if `offline_access` is present in scopes.
     */
    @Suppress("MemberVisibilityCanBePrivate")
    val promptForLogin: Boolean
    private val authSettings = parseConfigData(configData)
    private var authService: AuthorizationService? = null
    private class GetAuthorizationResponse(resultCaller: ActivityResultCaller, owner: LifecycleOwner):
        DtaCoActivityResult<Intent, ActivityResult>(resultCaller, ActivityResultContracts.StartActivityForResult(), owner)
    private lateinit var getAuthorizationResponse: GetAuthorizationResponse
    private lateinit var context: Context
    private val authStateManager = DtaAuthStateManager.getInstance(appContext)

    init {
        promptForLogin = authSettings.scope.splitToSequence(" ").contains("offline_access")
        // Initialize cachedToken using DtaAuthStateManager, which loads the saved token from
        // shared preferences.
        updateCachedToken()
    }

    /**
     * Associates with the given objects (usually an Activity or Fragment).
     *
     * @param resultCaller The [ActivityResultCaller] to use for location permission and services requests.
     * @param owner The [LifecycleOwner] to observe for stopping and destroying.
     * @param context The Context.
     */
    fun associateWithResultCallerAndOwner(resultCaller: ActivityResultCaller, owner: LifecycleOwner, context: Context) {
        this.context = context
        getAuthorizationResponse = GetAuthorizationResponse(resultCaller, owner)
        owner.lifecycle.addObserver(object: DefaultLifecycleObserver {
            override fun onStop(owner: LifecycleOwner) {
                dispose()
            }
        })
    }

    private var cachedToken: AccessToken? = null
        get() {
            // only return the token if it hasn't expired
            return field?.takeIf { Date().time < (it.expirationDate?.iso8601ToDate()?.time ?: 0) }
        }

    /**
     * Disposes of any open resources held by this class.
     */
    fun dispose() {
        authService?.dispose()
        authService = null
    }

    private fun requireAuthService(): AuthorizationService {
        return authService ?: AuthorizationService(context).also { authService = it }
    }

    companion object {
        private const val DEFAULT_SCOPES = "projects:read imodelaccess:read itwinjs organization profile email imodels:read realitydata:read savedviews:read savedviews:modify itwins:read openid offline_access"
        private const val DEFAULT_REDIRECT_URI = "imodeljs://app/signin-callback"
        private fun parseConfigData(configData: JSONObject): DtaAuthSettings {
            val apiPrefix = configData.optString("IMJS_OIDC_API_PREFIX")
            val issuerUrl = configData.optString("IMJS_OIDC_ISSUER_URL", "https://${apiPrefix}ims.bentley.com/")
            val clientId = configData.optString("IMJS_OIDC_CLIENT_ID")
            val redirectUrl = configData.optString("IMJS_OIDC_REDIRECT_URI", DEFAULT_REDIRECT_URI)
            val scope = configData.optString("IMJS_OIDC_SCOPE", DEFAULT_SCOPES)
            return DtaAuthSettings(Uri.parse(issuerUrl), clientId, Uri.parse(redirectUrl), scope)
        }
    }

    private suspend fun initAuthState() {
        if (authStateManager.current.isAuthorized)
            return
        val config = fetchConfigFromIssuer(authSettings.issuerUri)
        authStateManager.replace(if (config != null) AuthState(config) else AuthState())
    }

    private fun getAuthorizationRequestIntent(authState: AuthState): Intent {
        val authRequest = AuthorizationRequest.Builder(authState.authorizationServiceConfiguration!!,
            authSettings.clientId, ResponseTypeValues.CODE, authSettings.redirectUri
        ).apply {
            setScope(authSettings.scope).setCodeVerifier(CodeVerifierUtil.generateRandomCodeVerifier())
            if (promptForLogin) {
                setPrompt("login")
            }
        }.build()
        return requireAuthService().getAuthorizationRequestIntent(authRequest)
    }

    private suspend fun launchRequestAuthorization(authState: AuthState): AccessToken {
        return getAuthorizationResponse(getAuthorizationRequestIntent(authState)).takeIf { result ->
            result.resultCode == Activity.RESULT_OK
        }?.data?.let {
            handleAuthorizationResponse(it)
        } ?: AccessToken()
    }

    private suspend fun tryRefresh(): AccessToken? {
        return try {
            authStateManager.current.performActionWithFreshTokens(requireAuthService())
            authStateManager.updated()
            updateCachedToken()
        } catch (ex: Throwable) {
            if (ex == AuthorizationException.TokenRequestErrors.INVALID_GRANT) {
                try {
                    signOut()
                } catch (_: Throwable) {} // ignore
            }
            null
        }
    }

    private suspend fun signIn(): AccessToken {
        return try {
            initAuthState()
            launchRequestAuthorization(authStateManager.current)
        } catch (ex: Exception) {
//            itmApplication.logger.log(ITMLogger.Severity.Error, "Error fetching token: $ex")
            AccessToken()
        }
    }

    /**
     * Coroutine to handle getting the [AccessToken]. If a cached token is present, it is refreshed
     * if needed and returned. If that fails, a signin UI is presented to the user to fetch and return
     * an access token.
     *
     * @return The [AccessToken]. Note: if the login process fails for any reason, this [AccessToken]
     * will not be valid.
     */
    private suspend fun getAccessToken(): AccessToken {
        return tryRefresh() ?: signIn()
    }

    private fun updateCachedToken(): AccessToken {
        val authState = authStateManager.current
        val accessToken = if (authState.isAuthorized) {
            AccessToken("Bearer ${authState.accessToken}", authState.accessTokenExpirationTime?.epochMillisToISO8601())
        } else {
            AccessToken()
        }
        cachedToken = accessToken
        return accessToken
    }

    private suspend fun handleAuthorizationResponse(data: Intent): AccessToken {
        val authResponse = AuthorizationResponse.fromIntent(data)
        val authEx = if (authResponse == null) AuthorizationException.fromIntent(data) else null
        authStateManager.updateAfterAuthorization(authResponse, authEx)
        return authResponse?.let {
            try {
                val tokenResponse = requireAuthService().performTokenRequest(it.createTokenExchangeRequest())
                authStateManager.updateAfterTokenResponse(tokenResponse, null)
                updateCachedToken()
            } catch (tokenEx: AuthorizationException) {
                authStateManager.updateAfterTokenResponse(null, tokenEx)
                null
            }
        } ?: AccessToken()
    }

    /**
     * Function that is called by the iTwin backend to get an access token, along with its expiration date.
     *
     * @param completion Action that will have resolve called with the token and expiration date, or null values if
     * a token is not available. Note that the `expirationDate` parameter of `resolve` is expected to be an ISO
     * 8601 date string.
     */
    override fun getAccessToken(completion: AuthTokenCompletionAction) {
        MainScope().launch {
            // Right now the frontend asks for a token when trying to send a message to the backend.
            // That token is totally unused by the backend, so we can simply fail all requests that happen before the frontend launch has completed.
            // We don't want to make any actual token requests until the user does something that requires a token.
            val accessToken = getAccessToken()
            if (accessToken.token == null || accessToken.expirationDate == null)
                completion.error("Error logging in.")
            else
                completion.resolve(accessToken.token, accessToken.expirationDate)
        }
    }

    private suspend fun revokeToken(token: String, revokeUrl: URL, authorization: String) {
        withContext(Dispatchers.IO) {
            val connection = revokeUrl.openConnection() as HttpURLConnection
            try {
                val bodyBytes = "token=$token".toByteArray()
                connection.requestMethod = "POST"
                connection.setRequestProperty("Authorization", "Basic $authorization")
                connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                connection.setRequestProperty("Content-Length", "${bodyBytes.size}")
                connection.useCaches = false
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(bodyBytes.size)
                connection.outputStream.use {
                    it.write(bodyBytes)
                }
                if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                    throw Exception("Invalid response code from server: ${connection.responseCode}")
                }
            } finally {
                connection.disconnect()
            }
        }
    }

    private suspend fun revokeTokens() {
        val authState = authStateManager.current
        if (!authState.isAuthorized) return
        val tokens = setOfNotNull(authState.idToken, authState.accessToken, authState.refreshToken).takeIf { it.isNotEmpty() } ?: return
        val revokeURLString = authState.authorizationServiceConfiguration?.discoveryDoc?.docJson?.optStringNotEmpty("revocation_endpoint")
            ?: throw Exception("Could not find valid revocation URL.")
        val revokeURL = URL(revokeURLString).takeIf { it.protocol.equals("https", true) }
            ?: throw Exception("Token revocation URL is not https.")
        val authorization = Base64.getEncoder().encodeToString("${authSettings.clientId}:".toByteArray())
        val exceptions = mutableListOf<String>()
        for (token in tokens) {
            try {
                revokeToken(token, revokeURL, authorization)
            } catch (ex: Exception) {
                ex.message?.let { exceptions.add(it) }
            }
        }
        if (exceptions.isNotEmpty()) {
            throw Exception("Error${if (exceptions.size > 1) "s" else ""}) revoking tokens:\n" + exceptions.joinToString("\n"))
        }
    }

    @Suppress("unused")
    suspend fun signOut() {
        try {
            revokeTokens()
        } finally {
            authStateManager.clear()
            cachedToken = null
            notifyAccessTokenChanged(null, null as String?)
        }
    }
}

//region Extension Functions

/**
 * Convenience function convert a [Long] containing the number of milliseconds since the epoch into an
 * ISO 8601-formatted [String].
 *
 * @return A [String] containing an ISO 8601 format date.
 */
fun Long.epochMillisToISO8601(): String {
    return Instant.ofEpochMilli(this).toString()
}

/**
 * Convenience function to convert a [String] containing an ISO 8601 date into a [Date] object.
 *
 * @return The parsed [Date], or null if the receiver string could not be parsed into a valid [Date].
 */
fun String.iso8601ToDate(): Date? {
    try {
        return Date(Instant.parse(this).toEpochMilli())
    } catch (ex: Exception) {
        // Ignore
    }
    return try {
        @Suppress("SpellCheckingInspection")
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        if (this.endsWith('Z')) {
            format.timeZone = TimeZone.getTimeZone("UTC")
        }
        format.parse(this)
    } catch (ex: Exception) {
        return null
    }
}

/**
 * Suspend function wrapper of AuthState.performActionWithFreshTokens
 */
suspend fun AuthState.performActionWithFreshTokens(service: AuthorizationService) = suspendCoroutine { continuation ->
    performActionWithFreshTokens(service) { accessToken, idToken, ex ->
        if (ex != null)
            continuation.resumeWithException(ex)
        else
            continuation.resume(Pair(accessToken, idToken))
    }
}

/**
 * Suspend function wrapper of AuthorizationService.performTokenRequest
 */
suspend fun AuthorizationService.performTokenRequest(request: TokenRequest) = suspendCoroutine { continuation ->
    performTokenRequest(request) { tokenResponse, tokenEx ->
        if (tokenEx != null)
            continuation.resumeWithException(tokenEx)
        else
            continuation.resume(tokenResponse)
    }
}

/**
 * Suspend function wrapper of AuthorizationServiceConfiguration.fetchFromIssuer
 */
suspend fun fetchConfigFromIssuer(openIdConnectIssuerUri: Uri) = suspendCoroutine { continuation ->
    AuthorizationServiceConfiguration.fetchFromIssuer(openIdConnectIssuerUri) { config, configEx ->
        if (configEx != null)
            continuation.resumeWithException(configEx)
        else
            continuation.resume(config)
    }
}

//endregion
