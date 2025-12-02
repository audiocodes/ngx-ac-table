module.exports = {
  target: (dependencyName) => {
    // typed-emitter - https://github.com/andywer/typed-emitter/issues/43
    if (dependencyName.match(/^@angular|ng-packagr/u))
      return 'minor';
    if (dependencyName === 'zone.js')
      return 'patch';
    return 'latest';
  }
}
