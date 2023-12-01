package com.bentley.imodeljs_test_app

import android.net.Uri
import android.util.Base64
import com.bentley.itwin.AuthTokenCompletionAction
import com.bentley.itwin.AuthorizationClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.DataOutputStream
import java.net.URL
import java.util.*
import javax.net.ssl.HttpsURLConnection

class DtaServiceAuthorizationClient(env: JSONObject): AuthorizationClient() {
    data class AuthSettings(val clientId: String, val clientSecret: String, val scope: String, val authority: String)
    private val authSettings = parseEnv(env)
    private var accessToken: String? = null
    private var expirationDate: String? = null

    companion object {
        fun create(env: JSONObject): DtaServiceAuthorizationClient? {
            return try {
                DtaServiceAuthorizationClient(env)
            } catch (ex: Exception) {
                null
            }
        }
    }
    private fun parseEnv(env: JSONObject): AuthSettings {
        val clientId = env.optStringNotEmpty("IMJS_OIDC_CLIENT_ID")
        val clientSecret = env.optStringNotEmpty("IMJS_OIDC_CLIENT_SECRET")
        val scope = env.optStringNotEmpty("IMJS_OIDC_SCOPE")
        val authority = env.optStringNotEmpty("IMJS_SERVICE_AUTHORITY") ?: "https://ims.bentley.com"
        if (clientId == null || clientSecret == null || scope == null) {
            throw Exception("env does not contain necessary config data.")
        }
        val scopes = scope.split(" ")
        if (scopes.contains("openid") || scopes.contains("email") || scopes.contains("profile") || scopes.contains("organization")) {
            throw Exception("DtaServiceAuthSettings: Scopes for a service cannot include 'openid email profile organization'")
        }
        return AuthSettings(clientId, clientSecret, scope, authority)
    }

    private suspend fun generateAccessToken() {
        return withContext(Dispatchers.IO) {
            val authURL = URL("${authSettings.authority}/connect/token")
            with (authURL.openConnection() as HttpsURLConnection) {
                useCaches = false
                doOutput = true
                requestMethod = "POST"
                val encodedScope = Uri.encode(authSettings.scope)
                val body = "grant_type=client_credentials&scope=${encodedScope}"
                val bodyData = body.toByteArray()
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                setRequestProperty("charset", "utf-8")
                setRequestProperty("Content-Length", "${bodyData.size}")
                val encodedClientId = Uri.encode(authSettings.clientId)
                val encodedClientSecret = Uri.encode(authSettings.clientSecret)
                val encoded = "${encodedClientId}:${encodedClientSecret}"
                setRequestProperty("Authorization", "Basic ${Base64.encodeToString(encoded.toByteArray(), Base64.NO_WRAP)}")
                val os = DataOutputStream(outputStream)
                os.write(bodyData)
                os.flush()
                if (responseCode != 200) {
                    val message = "Wrong response code fetching token: $responseCode"
                    throw Exception(message)
                }
                val response = JSONObject(inputStream.bufferedReader().use(BufferedReader::readText))
                val responseValues = listOfNotNull(response.optStringNotEmpty("access_token"), response.optStringNotEmpty("expires_in"))
                if (responseValues.size != 2) {
                    throw Exception("Did not get token and expiration date in response.")
                }
                accessToken = "Bearer ${responseValues[0]}"
                val expiresIn = responseValues[1].toLong()
                expirationDate = Date(Date().time + expiresIn * 1000).toString()
            }
        }
    }

    private fun returnAccessToken(tokenAction: AuthTokenCompletionAction): Boolean {
        return let2(accessToken, expirationDate) {
            tokenAction.resolve(it.first, it.second)
            true
        } == true
    }

    override fun getAccessToken(tokenAction: AuthTokenCompletionAction) {
        if (returnAccessToken(tokenAction)) return
        MainScope().launch {
            try {
                generateAccessToken()
                if (!returnAccessToken(tokenAction)) {
                    tokenAction.error("Could not fetch access token")
                }
            } catch (ex: Exception) {
                tokenAction.error(ex.toString())
            }
        }
    }
}

inline fun <T1: Any, T2: Any, R: Any> let2(p1: T1?, p2: T2?, block: (Pair<T1, T2>)->R?): R? {
    return if (p1 != null && p2 != null) block(Pair(p1, p2)) else null
}
