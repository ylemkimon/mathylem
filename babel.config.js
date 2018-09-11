module.exports = (api) => {
  api.cache.forever();

  const presets = [
    ['@babel/env', {
      loose: true,
    }],
    '@babel/flow',
  ];
  const plugins = [
    '@babel/transform-runtime',
    ['@babel/proposal-class-properties', {
      loose: true,
    }],
  ];

  return {
    presets,
    plugins,
  };
};
