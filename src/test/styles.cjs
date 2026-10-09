module.exports = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : name });
