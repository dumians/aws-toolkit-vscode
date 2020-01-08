/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert'
import * as fs from 'fs-extra'
import * as sinon from 'sinon'
import { SharedCredentialsProviderFactory } from '../../../credentials/providers/sharedCredentialsProviderFactory'
import * as sharedCredentials from '../../../credentials/sharedCredentials'
import { Profile } from '../../../shared/credentials/credentialsFile'

describe('SharedCredentialsProviderFactory', async () => {
    let sandbox: sinon.SinonSandbox
    let loadSharedCredentialsProfilesStub: sinon.SinonStub<[], Promise<Map<string, Profile>>>
    let sharedCredentialProfiles: Map<string, Profile>

    const validProfile: Profile = {
        aws_access_key_id: 'x',
        aws_secret_access_key: 'y'
    }

    const inValidProfile: Profile = {
        aws_access_key_id: 'x'
    }

    const validProfileName1 = 'default'
    const validProfileName2 = 'alt'
    const invalidProfileName = 'gary'

    beforeEach(async () => {
        sandbox = sinon.createSandbox()

        sharedCredentialProfiles = new Map<string, Profile>()
        sharedCredentialProfiles.set(validProfileName1, validProfile)
        sharedCredentialProfiles.set(validProfileName2, validProfile)

        loadSharedCredentialsProfilesStub = sandbox
            .stub(sharedCredentials, 'loadSharedCredentialsProfiles')
            .callsFake(async () => sharedCredentialProfiles)
    })

    afterEach(async () => {
        sandbox.restore()
    })

    it('produces credential providers from shared credentials profiles', async () => {
        const sut = new SharedCredentialsProviderFactory()

        await sut.refresh()

        const providers = sut.listProviders()

        assert.strictEqual(providers.length, 2, 'Expected two providers to be created')
        assert.ok(
            providers.find(p => p.getCredentialsProviderId() === `profile:${validProfileName1}`),
            'Expected to find the first profile'
        )
        assert.ok(
            providers.find(p => p.getCredentialsProviderId() === `profile:${validProfileName2}`),
            'Expected to find the second profile'
        )
    })

    it('does not load providers for invalid profiles', async () => {
        sharedCredentialProfiles.set(invalidProfileName, inValidProfile)

        const sut = new SharedCredentialsProviderFactory()

        await sut.refresh()

        const providers = sut.listProviders()

        assert.strictEqual(providers.length, 2, 'Expected two providers to be created') // the valid ones
        assert.strictEqual(sut.getProvider(`profile:${invalidProfileName}`), undefined)
    })

    it('refresh does not reload from file if the file has not changed', async () => {
        sandbox.stub(fs, 'stat').resolves(({
            mtimeMs: 1
        } as any) as fs.Stats)

        const sut = new SharedCredentialsProviderFactory()

        // First load
        await sut.refresh()

        // Expect: No reload
        await sut.refresh()

        assert.ok(
            loadSharedCredentialsProfilesStub.calledOnce,
            'Credentials should have only been loaded from disk once'
        )
    })

    it('refresh reloads from file if the file has changed', async () => {
        let lastModifiedMillis = 1
        sandbox.stub(fs, 'stat').callsFake(async () => {
            return ({
                mtimeMs: lastModifiedMillis
            } as any) as fs.Stats
        })

        const sut = new SharedCredentialsProviderFactory()

        // First load
        await sut.refresh()

        // Simulate modifying files
        lastModifiedMillis++

        // Expect: Reload
        await sut.refresh()

        assert.ok(loadSharedCredentialsProfilesStub.calledTwice, 'Credentials should have been loaded from disk twice')
    })
})