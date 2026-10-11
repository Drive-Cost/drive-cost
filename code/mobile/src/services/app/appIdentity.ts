import appConfig from '../../../app.json';

type ApplicationConfig = {
  name?: string;
  version?: string;
  ios?: { buildNumber?: string };
  android?: { versionCode?: number };
  extra?: {
    legal?: {
      privacyPolicyUrl?: string;
      termsUrl?: string;
    };
  };
};

export type AppReleaseIdentity = {
  name: string;
  version?: string;
  buildNumber?: string;
};

export type SettingsLink = {
  label: 'Privacy Policy' | 'Terms';
  url: string;
};

export function getAppReleaseIdentity(config: ApplicationConfig): AppReleaseIdentity {
  return {
    name: config.name?.trim() || 'DriveCost',
    version: config.version?.trim() || undefined,
    buildNumber: config.ios?.buildNumber?.trim() || formatAndroidVersionCode(config.android?.versionCode),
  };
}

export function getConfiguredSettingsLinks(config: ApplicationConfig): SettingsLink[] {
  const legal = config.extra?.legal;
  return [settingsLink('Privacy Policy', legal?.privacyPolicyUrl), settingsLink('Terms', legal?.termsUrl)].filter(
    (link): link is SettingsLink => link !== undefined
  );
}

function formatAndroidVersionCode(versionCode?: number): string | undefined {
  return typeof versionCode === 'number' && Number.isInteger(versionCode) && versionCode > 0
    ? String(versionCode)
    : undefined;
}

function settingsLink(label: SettingsLink['label'], value?: string): SettingsLink | undefined {
  const url = value?.trim();
  if (!url || !/^https:\/\//i.test(url)) return undefined;
  return { label, url };
}

const config = appConfig.expo as ApplicationConfig;

export const appReleaseIdentity = getAppReleaseIdentity(config);
export const configuredSettingsLinks = getConfiguredSettingsLinks(config);
