// regex to remove https://
const regex = /(^\w+:|^)\/\//;

module.exports = function parseHost(referer) {
    return referer.replace(regex, '').split('/')[0];
};