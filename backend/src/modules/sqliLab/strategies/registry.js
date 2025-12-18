const booleanStrategy = require('./boolean.strategy');
const unionStrategy = require('./union.strategy');
const errorStrategy = require('./error.strategy');
const timeStrategy = require('./time.strategy');

function getStrategy(pattern) {
  if (pattern === 'boolean') return booleanStrategy;
  if (pattern === 'union') return unionStrategy;
  if (pattern === 'error') return errorStrategy;
  if (pattern === 'time') return timeStrategy;
  throw new Error('Unsupported pattern');
}

module.exports = { getStrategy };
