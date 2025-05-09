import type { Features, FeaturesKeys } from './TypeUtil.js';
export declare const OptionsUtil: {
    getFeatureValue(key: FeaturesKeys, features?: Features): boolean | import("./TypeUtil.js").SocialProvider[] | import("./TypeUtil.js").ConnectorTypeOrder[] | import("./TypeUtil.js").WalletFeature[] | import("./TypeUtil.js").ConnectMethod[] | undefined;
    filterSocialsByPlatform<T>(socials: Features["socials"]): T | import("./TypeUtil.js").SocialProvider[];
};
