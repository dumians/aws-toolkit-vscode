/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs-extra'
import { getLogger, Logger } from '../../shared/logger'
import {
    getConfigFilename,
    getCredentialsFilename,
    loadSharedCredentialsProfiles,
    updateAwsSdkLoadConfigEnvironmentVariable
} from '../sharedCredentials'
import { BaseCredentialsProviderFactory } from './credentialsProviderFactory'
import { SharedCredentialsProvider } from './sharedCredentialsProvider'

export class SharedCredentialsProviderFactory extends BaseCredentialsProviderFactory<SharedCredentialsProvider> {
    public static readonly CREDENTIAL_TYPE = 'profile'

    private readonly logger: Logger = getLogger()

    private loadedCredentialsModificationDate: number = 0
    private loadedConfigModificationDate: number = 0

    public getCredentialType(): string {
        return SharedCredentialsProviderFactory.CREDENTIAL_TYPE
    }

    public async refresh(): Promise<void> {
        if (!(await this.needsRefresh())) {
            return
        }

        await this.loadSharedCredentialsProviders()
    }

    protected resetProviders() {
        this.loadedCredentialsModificationDate = 0
        this.loadedConfigModificationDate = 0

        super.resetProviders()
    }

    private async needsRefresh(): Promise<boolean> {
        const credentialsLastMod = await this.getLastModifiedTime(getCredentialsFilename())
        const configLastMod = await this.getLastModifiedTime(getConfigFilename())

        return (
            this.loadedCredentialsModificationDate !== credentialsLastMod ||
            this.loadedConfigModificationDate !== configLastMod
        )
    }

    private async loadSharedCredentialsProviders(): Promise<void> {
        this.resetProviders()

        // TODO : CC : If system has config but not credentials (and no envvar defined), try writing a blank credentials file into toolkit temp. This should compensate for JS SDK ENOENT issue.
        this.logger.verbose('Loading all Shared Credentials Profiles')
        const allCredentialProfiles = await loadSharedCredentialsProfiles()
        this.loadedCredentialsModificationDate = await this.getLastModifiedTime(getCredentialsFilename())
        this.loadedConfigModificationDate = await this.getLastModifiedTime(getConfigFilename())
        await updateAwsSdkLoadConfigEnvironmentVariable()

        for (const profileName of allCredentialProfiles.keys()) {
            const provider = new SharedCredentialsProvider(profileName, allCredentialProfiles)
            await this.addProviderIfValid(profileName, provider)
        }
    }

    private async addProviderIfValid(profileName: string, provider: SharedCredentialsProvider): Promise<void> {
        const validationMessage = provider.validate()
        if (validationMessage) {
            this.logger.warn(
                `Shared Credentials Profile ${profileName} is not valid. It will not be used by the toolkit. ${validationMessage}`
            )
        } else {
            this.addProvider(provider)
        }
    }

    private async getLastModifiedTime(filepath: string): Promise<number> {
        try {
            const stat = await fs.stat(filepath)

            return stat.mtimeMs
        } catch (err) {
            return 0
        }
    }
}
