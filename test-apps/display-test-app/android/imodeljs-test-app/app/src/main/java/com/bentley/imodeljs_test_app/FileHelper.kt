/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
package com.bentley.imodeljs_test_app

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * File related utility functions.
 */
object FileHelper {
    /**
     * Determines the display name for the uri using the content resolver.
     * @param uri The input Uri.
     * @param contentResolver The content resolver to query for the display name.
     * @return The display name or null if it wasn't found.
     */
    fun getFileDisplayName(uri: Uri, contentResolver: ContentResolver): String? {
        contentResolver.query(uri, null, null, null, null, null)?.let { cursor ->
            if (cursor.moveToFirst()) {
                val columnIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (columnIndex >= 0) {
                    return cursor.getString(columnIndex)
                }
            }
            cursor.close()
        }
        return null
    }

    /**
     * Copies the input stream to the destination directory using the input display name.
     * @param inputStream The stream to copy.
     * @param destDir The destination directory.
     * @param displayName The file name.
     * @return The full path of the output file.
     */
    private fun copyFile(inputStream: InputStream, destDir: File, displayName: String): String {
        if (!destDir.exists()) {
            destDir.mkdirs()
        }
        // @TODO: use File to combine the path and the dir instead of hardcoding the /
        val dstPath = destDir.absolutePath + "/" + displayName
        val outputStream = FileOutputStream(dstPath)
        val buffer = ByteArray(1024)
        var length: Int
        while (inputStream.read(buffer).also { length = it } > 0) {
            outputStream.write(buffer, 0, length)
        }
        outputStream.flush()
        outputStream.close()
        return dstPath
    }

    /**
     * Copies the input uri to the destination directory using the display name.
     * @param context The context for getting external files and the content resolver.
     * @param uri The input Uri to copy.
     * @param destDir The destination directory.
     * @return The full path of the copied file, null if it failed.
     */
    fun copyToExternalFiles(context: Context, uri: Uri, destDir: String, displayName: String): String? {
        var result: String? = null
//        context.filesDir.let { filesDir ->
        context.getExternalFilesDir(null)?.let { filesDir ->
            context.contentResolver.openInputStream(uri)?.let { inputStream ->
                result = copyFile(inputStream, File(filesDir, destDir), displayName)
                inputStream.close()
            }
        }
        return result
    }

    /**
     * Gets the external files in the input directory name.
     * @param context The context.
     * @param dirName The directory name.
     * @return A list of external files, possibly empty.
     */
    fun getExternalFiles(context: Context, dirName: String): List<String> {
        return context.getExternalFilesDir(dirName)?.listFiles()?.map { it.toString() } ?: emptyList()
    }

    /**
     * Gets the external files in the input directory name that end with the input extension.
     * @param context The context.
     * @param dirName The directory name.
     * @param extension The file extension to filter with.
     * @return A list of external files, possibly empty.
     */
    fun getExternalFiles(context: Context, dirName: String, extension: String): List<String> {
        return getExternalFiles(context, dirName).filter { name ->
            extension.isEmpty() || name.endsWith(extension, true)
        }
    }
}
