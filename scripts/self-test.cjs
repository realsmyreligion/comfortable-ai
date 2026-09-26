const assert = require('assert');
const core = require('../src/marketCore');

const sample = {
  stocks: {
    mex: {
      update: 1000,
      stocks: [
        {
          id: 1,
          name: 'Test Plushie',
          quantity: 50,
          cost: 100
        }
      ]
    },

    can: {
      update: 1000,
      stocks: [
        {
          id: 2,
          name: 'Test Flower',
          quantity: 0,
          cost: 200
        }
      ]
    }
  }
};

const rows =
  core.normalizeForeignStock(
    sample
  );

assert.equal(
  rows.length,
  2
);

assert.equal(
  rows[0].key,
  'mex:1'
);

assert.equal(
  core.groupForeignStock(
    rows
  ).length,
  2
);

assert.equal(
  core.effectiveCapacity(
    22,
    true
  ),
  44
);

assert.equal(
  core.flightMinutes(
    'mex',
    'standard',
    false
  ),
  24
);

assert.equal(
  core.flightMinutes(
    'mex',
    'business',
    true
  ),
  5
);

const candidate =
  core.computeCandidate(
    {
      ...rows[0],
      marketPrice: 1000
    },
    {
      capacity: 44,
      flightMode: 'standard',
      mailingBook: false,
      velocity: 1
    }
  );

assert.equal(
  candidate.profitEach,
  900
);

assert(
  candidate.projectedQuantity <
  rows[0].quantity
);

const update =
  core.updateVelocityState(
    {
      'mex:1': {
        quantity: 100,
        updated: 940
      }
    },
    [rows[0]],
    {}
  );

assert(
  update.velocityState[
    'mex:1'
  ].rate > 0
);

console.log(
  '✓ Torn Pulse Market core self-test passed'
);
