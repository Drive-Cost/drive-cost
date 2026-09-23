import { describe, expect, it } from 'vitest';
import {
    appReleaseIdentity,
    configuredSettingsLinks,
    getAppReleaseIdentity,
    getConfiguredSettingsLinks,
} from '../../../src/services/app/appIdentity';

describe('application identity presentation', () => {
    it('presents the release identity from the application configuration', () => {
        expect(appReleaseIdentity).toEqual({ name: 'DriveCost', version: '0.1.0', buildNumber: '1' });
        expect(configuredSettingsLinks).toEqual([]);
    });

    it('uses the configured app version and iOS build number', () => {
        expect(getAppReleaseIdentity({
            name: 'DriveCost',
            version: '0.1.0',
            ios: { buildNumber: '7' },
            android: { versionCode: 4 },
        })).toEqual({ name: 'DriveCost', version: '0.1.0', buildNumber: '7' });
    });

    it('uses Android version code when an iOS build number is not configured', () => {
        expect(getAppReleaseIdentity({ android: { versionCode: 3 } })).toEqual({ name: 'DriveCost', buildNumber: '3' });
    });

    it('only returns configured HTTPS legal links', () => {
        expect(getConfiguredSettingsLinks({
            extra: { legal: { privacyPolicyUrl: 'https://drivecost.app/privacy', termsUrl: 'mailto:hello@drivecost.app' } },
        })).toEqual([{ label: 'Privacy Policy', url: 'https://drivecost.app/privacy' }]);
    });
});
