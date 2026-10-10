/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import android.system.Os
import androidx.test.platform.app.InstrumentationRegistry
import com.bentley.itwin.IModelJsHost
import kotlinx.coroutines.Job
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.time.Duration.Companion.seconds

class HostTestHelper private constructor() {
    private val host: IModelJsHost
    private val messenger: TestMessenger

    companion object {
        private val instance: Result<HostTestHelper> by lazy { runCatching { HostTestHelper() } }

        fun getHost(): IModelJsHost = instance.getOrThrow().host

        fun getMessenger(): TestMessenger = instance.getOrThrow().messenger
    }

    init {
        val backendStartJob = Job()

        Os.setenv("IMJS_DTA_INTEGRATION_TEST", "true", true)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        host = IModelJsHost(context, true).apply {
            setBackendPath("www/mobile")
            setHomePath("www/home")
        }

        messenger = TestMessenger(host)
        messenger.addQueryHandler("dtaBackendStarted") { _, _, response ->
            backendStartJob.complete()
            response.resolve("")
        }

        host.startup()
        runBlocking {
            withTimeout(30.seconds) { backendStartJob.join() }
        }
    }
}
