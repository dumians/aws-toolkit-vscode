/*!
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

import * as vscode from 'vscode'

const ERROR_MESSAGE_USER_CANCELLED = localize(
    'AWS.error.mfa.userCancelled',
    'User cancelled entering authentication code'
)

/**
 * @description Prompts user for MFA token
 *
 * Entered token is passed to the callback.
 * If user cancels out, the callback is passed an error with a fixed message string.
 *
 * @param mfaSerial Serial arn of MFA device
 * @param profileName Name of Credentials profile we are asking an MFA Token for
 * @param callback tokens/errors are passed through here
 */
export async function getMfaTokenFromUser(
    mfaSerial: string,
    profileName: string,
    callback: (err?: Error, token?: string) => void
): Promise<void> {
    try {
        const token = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: localize('AWS.prompt.mfa.enterCode.placeholder', 'Enter Authentication Code Here'),
            prompt: localize(
                'AWS.prompt.mfa.enterCode.prompt',
                'Enter authentication code for profile {0}',
                profileName
            )
        })

        // Distinguish user cancel vs code entry issues with the error message
        if (!token) {
            throw new Error(ERROR_MESSAGE_USER_CANCELLED)
        }

        callback(undefined, token)
    } catch (err) {
        const error = err as Error
        callback(error)
    }
}
