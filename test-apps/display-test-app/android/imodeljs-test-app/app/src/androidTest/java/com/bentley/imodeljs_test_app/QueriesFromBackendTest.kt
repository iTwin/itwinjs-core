/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.bentley.itwin.NativeQueryResponseAction
import com.bentley.itwin.QueryToNativeCallback
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.AfterClass
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.rules.ErrorCollector
import org.junit.runner.RunWith
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class QueriesFromBackendTest {
    @get:Rule
    val errors = ErrorCollector()

    companion object {
        private val handlerNames = mutableListOf<String>()

        @JvmStatic
        @BeforeClass
        fun setUpQueryHandlers() {
            val messenger = HostTestHelper.getMessenger()
            val addHandler = { name: String, handler: QueryToNativeCallback ->
                messenger.addQueryHandler(name, handler)
                handlerNames.add(name)
            }

            addHandler("test.syncResolve") { _, message, response ->
                response.resolve(message)
            }

            addHandler("test.asyncResolve") { _, message, response ->
                thread {
                    Thread.sleep(200)
                    response.resolve(message)
                }
            }

            addHandler("test.reject") { _, _, response ->
                response.error("expected native rejection")
            }

            addHandler("test.throw") { _, _, _ ->
                throw RuntimeException("expected native throw")
            }

            addHandler("test.duplicateReply") { _, _, response ->
                response.resolve("first")
                runCatching { response.resolve("second") }
            }

            addHandler("test.concurrentReply") { _, _, response ->
                replyConcurrently(response)
            }

            addHandler("test.echoDelayed") { _, message, response ->
                thread {
                    Thread.sleep(JSONObject(message).getLong("delayMs"))
                    response.resolve(message)
                }
            }
        }

        @JvmStatic
        @AfterClass
        fun clearQueryHandlers() {
            val messenger = HostTestHelper.getMessenger()
            for (handlerName in handlerNames)
                messenger.removeQueryHandler(handlerName)

            handlerNames.clear()
        }

        private fun replyConcurrently(responseAction: NativeQueryResponseAction) {
            val barrier = CyclicBarrier(2)
            listOf("a", "b").forEach { response ->
                thread {
                    runCatching { barrier.await(1, TimeUnit.SECONDS) }
                    runCatching { responseAction.resolve(response) }
                }
            }
        }
    }

    @Test(timeout = 30_000 /* ms */)
    fun backendQueriesToNative() = runBlocking {
        val reply = HostTestHelper.getMessenger().query("test.runQueriesFromBackendTest", "")

        check(reply is QueryReply.Result) { "dta.bridge.runBackendPhase: $reply" }
        val json = JSONObject(reply.value)
        val cases = json.getJSONArray("cases")
        val failures = json.getJSONArray("failures")

        if (cases.length() == 0) {
            errors.addError(AssertionError("No backend-to-native cases ran"))
        }

        for(i in 0 until failures.length()) {
            errors.addError(AssertionError(failures.getString(i)))
        }
    }
}
