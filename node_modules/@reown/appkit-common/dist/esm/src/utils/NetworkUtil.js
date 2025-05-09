export const NetworkUtil = {
    caipNetworkIdToNumber(caipnetworkId) {
        return caipnetworkId ? Number(caipnetworkId.split(':')[1]) : undefined;
    },
    parseEvmChainId(chainId) {
        return typeof chainId === 'string'
            ? this.caipNetworkIdToNumber(chainId)
            : chainId;
    },
    getNetworksByNamespace(networks, namespace) {
        return networks?.filter(network => network.chainNamespace === namespace) || [];
    },
    getFirstNetworkByNamespace(networks, namespace) {
        return this.getNetworksByNamespace(networks, namespace)[0];
    }
};
//# sourceMappingURL=NetworkUtil.js.map