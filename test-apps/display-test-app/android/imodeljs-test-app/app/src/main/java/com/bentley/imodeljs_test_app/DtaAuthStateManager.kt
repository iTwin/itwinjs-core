/* This code is based on the AppAuth-Android sample app code found here:
 * https://github.com/openid/AppAuth-Android/blob/master/app/java/net/openid/appauthdemo/AuthStateManager.java
 *
 * The following modifications were made:
 * - It was converted to Kotlin using Android Studio's automatic conversion process, then cleaned up.
 * - The unused updateAfterRegistration function was removed.
 * - The ITM prefix was added to various items.
 * - The constructor and getInstance were changed to take an ITMApplication instead of a Context.
 * - The Log.w() function call was replaced with ITMApplication.logger.log().
 * - Added clear() and updated() functions.
 * - Added documentation comments.
 * - Added disableSharedPreferences functionality.
 *
 * That original code is licensed under the following Apache 2.0 license:
 *
 * Copyright 2017 The AppAuth for Android Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*---------------------------------------------------------------------------------------------
* Modifications Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import android.content.Context
import androidx.annotation.AnyThread
import net.openid.appauth.*
import org.json.JSONException
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock

/**
 * Class to manage an AppAuth-Android [AuthState] and optionally persist it in shared preferences.
 *
 * @param context The application context.
 */
class DtaAuthStateManager private constructor(private val context: Context) {
    private val mPrefs = context.getSharedPreferences(STORE_NAME, Context.MODE_PRIVATE)
    private val mPrefsLock: ReentrantLock = ReentrantLock()
    private val mCurrentAuthState: AtomicReference<AuthState> = AtomicReference()

    /**
     * The [AuthState] value being managed.
     */
    @get:AnyThread
    val current: AuthState
        get() {
            if (mCurrentAuthState.get() != null) {
                return mCurrentAuthState.get()
            }
            val state = readState()
            return if (mCurrentAuthState.compareAndSet(null, state)) {
                state
            } else {
                mCurrentAuthState.get()
            }
        }

    /**
     * Reset [current] to an empty state and clear any settings stored in shared preferences.
     */
    @AnyThread
    fun clear() {
        mCurrentAuthState.set(AuthState())
        writeState(null)
    }

    /**
     * Inform the receiver that its managed [AuthState] has updated.
     *
     * This update the [AuthState] stored in shared preferences to match the current values. Call this
     * after making changes to the value returned by [current] (for example due to a call to
     * `performActionWithFreshTokens`).
     */
    @AnyThread
    fun updated() {
        writeState(mCurrentAuthState.get())
    }

    /**
     * Replace the managed [AuthState] with a new one and optionally store the data in shared preferences.
     *
     * __Note__: Data will be stored in shared preferences if [disableSharedPreferences] is `false`.
     *
     * @param state The new [AuthState] to manage.
     * @return [state]
     */
    @AnyThread
    fun replace(state: AuthState): AuthState {
        writeState(state)
        mCurrentAuthState.set(state)
        return state
    }

    /**
     * Update the managed [AuthState] based on the given parameters and optionally store the updated
     * data in shared preferences.
     *
     * __Note__: Data will be stored in shared preferences if [disableSharedPreferences] is `false`.
     *
     * @param response The response to the authorization request.
     * @param ex The exception returned by the authorization request.
     * @return The updated [AuthState] that reflects the authorization response and exception.
     */
    @AnyThread
    fun updateAfterAuthorization(
        response: AuthorizationResponse?,
        ex: AuthorizationException?
    ): AuthState {
        val current = current
        current.update(response, ex)
        return replace(current)
    }

    /**
     * Update the managed [AuthState] based on the given parameters and optionally store the updated
     * data in shared preferences.
     *
     * __Note__: Data will be stored in shared preferences if [disableSharedPreferences] is `false`.
     *
     * @param response The response to the token request.
     * @param ex The exception returned by the token request.
     * @return The updated [AuthState] that reflects the token response and exception.
     */
    @AnyThread
    fun updateAfterTokenResponse(
        response: TokenResponse?,
        ex: AuthorizationException?
    ): AuthState {
        val current = current
        current.update(response, ex)
        return replace(current)
    }

    @AnyThread
    private fun readState(): AuthState {
        if (disableSharedPreferences) return AuthState()
        mPrefsLock.lock()
        return try {
            val currentState = mPrefs.getString(KEY_STATE, null)
                ?: return AuthState()
            try {
                AuthState.jsonDeserialize(currentState)
            } catch (ex: JSONException) {
//                itmApplication.logger.log(ITMLogger.Severity.Warning, "Failed to deserialize stored auth state - discarding")
                AuthState()
            }
        } finally {
            mPrefsLock.unlock()
        }
    }

    @AnyThread
    private fun writeState(state: AuthState?) {
        mPrefsLock.lock()
        try {
            val editor = mPrefs.edit()
            if (state == null || disableSharedPreferences) {
                editor.remove(KEY_STATE)
            } else {
                editor.putString(KEY_STATE, state.jsonSerializeString())
            }
            check(editor.commit()) { "Failed to write state to shared prefs" }
        } finally {
            mPrefsLock.unlock()
        }
    }

    companion object {
        /**
         * Flag to disable reading and writing the managed [AuthState] to shared preferences. Set this
         * to `true` to disable storing the [AuthState] in shared preferences and remove any existing
         * stored value.
         */
        var disableSharedPreferences = false
            set(value) {
                field = value
                val manager: DtaAuthStateManager? = INSTANCE_REF.get().get()
                if (manager != null && value) {
                    manager.writeState(null)
                }
            }
        private val INSTANCE_REF: AtomicReference<WeakReference<DtaAuthStateManager>> =
            AtomicReference(WeakReference(null))
        private const val STORE_NAME = "DtaAuthState"
        private const val KEY_STATE = "state"

        /**
         * Return the shared [DtaAuthStateManager], creating it if necessary.
         *
         * __Note__: [context] is only used during the creation of the shared [DtaAuthStateManager]
         * the first time this is called. All subsequent calls ignore [context] and return the
         * previously created [DtaAuthStateManager].
         *
         * @param context The application context.
         * that is used by the [DtaAuthStateManager].
         */
        @AnyThread
        fun getInstance(context: Context): DtaAuthStateManager {
            var manager: DtaAuthStateManager? = INSTANCE_REF.get().get()
            if (manager == null) {
                manager = DtaAuthStateManager(context)
                INSTANCE_REF.set(WeakReference(manager))
            }
            return manager
        }
    }
}
