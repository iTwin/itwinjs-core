/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import com.bentley.itwin.IModelJsHost
import com.bentley.itwin.NativeQueryResponseAction
import com.bentley.itwin.QueryToNativeCallback
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

sealed class QueryReply {
    data class Result(val value: String) : QueryReply()
    data class Error(val message: String) : QueryReply()
}

class TestMessenger(private val host: IModelJsHost) {
    private val queryHandlers = mutableMapOf<String, QueryToNativeCallback>()

    init {
        host.setQueryCallback { name, message, responseAction ->
            handleQuery(name, message, responseAction)
        }
    }

    fun addQueryHandler(name: String, handler: QueryToNativeCallback) {
        queryHandlers[name] = handler
    }

    fun removeQueryHandler(name: String) {
        queryHandlers.remove(name)
    }

    suspend fun query(name: String, message: String): QueryReply =
        suspendCancellableCoroutine { continuation ->
            host.queryBackend(name, message) { result, isError ->
                val reply = if (isError) QueryReply.Error(result) else QueryReply.Result(result)
                continuation.resume(reply)
            }
        }

    private fun handleQuery(name: String, message: String, responseAction: NativeQueryResponseAction) {
        val handler = queryHandlers[name]
        if (handler != null)
            handler.onQuery(name, message, responseAction)
        else
            responseAction.error("No registered handler")
    }
}
