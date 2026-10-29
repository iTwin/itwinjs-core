/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.supervisorScope
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout
import org.junit.runner.RunWith


@RunWith(AndroidJUnit4::class)
class QueriesToBackendTest {
    @get:Rule
    val testCaseTimeout: Timeout = Timeout.seconds(10)

    private val messenger = HostTestHelper.getMessenger()

    @Test
    fun synchronousReply() = runBlocking {
        val reply = messenger.query("test.syncResolve", "hello")
        assertEquals(QueryReply.Result("hello"), reply)
    }

    @Test
    fun asynchronousReply() = runBlocking {
        val reply = messenger.query("test.asyncResolve", "delayed hello")
        assertEquals(QueryReply.Result("delayed hello"), reply)
    }

    @Test
    fun backendRejects() = runBlocking {
        val reply = messenger.query("test.reject", "")
        assertEquals(QueryReply.Error("expected backend rejection"), reply)
    }

    @Test
    fun unregisteredQuery() = runBlocking {
        val reply = messenger.query("test.unregistered", "")
        assertEquals(QueryReply.Error("MobileHost query handler not registered."), reply)
    }

    @Test
    fun concurrentQueries() = runBlocking {
        val count = 20
        val messages = (0 until count).map { index ->
            JSONObject().put("id", index).put("delayMs", (count - index) * 20).toString()
        }

        val replies = supervisorScope {
            messages.map { async(Dispatchers.IO) { messenger.query("test.echoDelayed", it)} }
        }

        messages.zip(replies.awaitAll()).forEach { (message, reply) ->
            assertEquals(QueryReply.Result(message), reply)
        }
    }
}
