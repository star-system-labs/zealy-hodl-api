const request = require('supertest');

process.env.TEST_MODE = 'true';
process.env.API_KEY = 'test-key';
process.env.BALANCE_TIER_1_MIN = '100';
process.env.BALANCE_TIER_1_DAYS = '7';
process.env.TOKEN_ADDRESS = '0x98830a6cc6f8964cec4ffd65f19edebba6fef865';
process.env.RPC_URL = 'https://mainnet.infura.io/v3/placeholder';
process.env.TOKEN_DECIMALS = '18';

const { app } = require('../server');

const parseJson = (response) => JSON.parse(response.text);

describe('Load test for /zealy/test', () => {
  const iterations = parseInt(process.env.LOAD_TEST_ITERATIONS || '2500', 10);
  const batchSize = parseInt(process.env.LOAD_TEST_BATCH_SIZE || '50', 10);
  const timeoutMs = parseInt(process.env.LOAD_TEST_TIMEOUT_MS || '6000000', 10);
  const batchDelayMs = parseInt(process.env.LOAD_TEST_BATCH_DELAY_MS || '0', 10);
  const apiKey = 'test-key';
  const agent = request.agent(app);

  const makeRequest = async (index) => {
    const walletSuffix = (1000 + index).toString(16).padStart(4, '0');
    const response = await agent
      .post('/zealy/test')
      .set('x-api-key', apiKey)
      .send({
        wallet: `0x000000000000000000000000000000000000${walletSuffix}`,
        questId: 'balance-tier-1',
        forceSuccess: true
      })
      .expect(200);

    const payload = parseJson(response);
    expect(payload.testMode).toBe(true);
    expect(payload.requestedTier?.qualified).toBe(true);
  };

  const runBatches = async () => {
    let completed = 0;
    while (completed < iterations) {
      const remaining = iterations - completed;
      const currentBatchSize = Math.min(batchSize, remaining);
      const batch = [];
      for (let i = 0; i < currentBatchSize; i++, completed++) {
        batch.push(makeRequest(completed));
      }
      await Promise.all(batch);
      if (batchDelayMs > 0 && completed < iterations) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }
  };

  const scenarioLabel = batchSize > 1 ? 'batched' : 'sequential';

  test(
    `should complete ${iterations} ${scenarioLabel} requests (batch size: ${batchSize})`,
    async () => {
      const start = Date.now();
      await runBatches();
      const durationMs = Date.now() - start;
      console.log(
        `Completed ${iterations} /zealy/test calls in ${durationMs}ms (mode: ${scenarioLabel}, batch size: ${batchSize})`
      );
    },
    timeoutMs
  );
});
