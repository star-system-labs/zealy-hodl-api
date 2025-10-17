const request = require('supertest');
const crypto = require('crypto');

process.env.TEST_MODE = 'true';
process.env.API_KEY = 'test-key';

process.env.REQUIRE_QUEST_ID = 'false';
process.env.REQUIRED_QUEST_ID = 'balance-tier-1';
process.env.ZEALY_WEBHOOK_SECRET = 'super-secret';
process.env.BALANCE_TIER_1_MIN = '100';
process.env.BALANCE_TIER_1_DAYS = '7';
process.env.BALANCE_TIER_2_MIN = '1000';
process.env.BALANCE_TIER_2_DAYS = '14';
process.env.BALANCE_TIER_3_MIN = '10000';
process.env.BALANCE_TIER_3_DAYS = '21';

process.env.MIN_HODL_1 = '10';
process.env.MIN_HODL_2 = '30';
process.env.MIN_HODL_3 = '100';
process.env.HODL_TIER_1_DAYS = '7';
process.env.HODL_TIER_2_DAYS = '30';
process.env.HODL_TIER_3_DAYS = '90';

process.env.FINAL_TIER_1_MIN = '100';
process.env.FINAL_TIER_1_DAYS = '7';
process.env.FINAL_TIER_2_MIN = '1000';
process.env.FINAL_TIER_2_DAYS = '30';
process.env.FINAL_TIER_3_MIN = '10000';
process.env.FINAL_TIER_3_DAYS = '90';

process.env.TOKEN_ADDRESS = '0x6982508145454ce325ddbe47a25d4ec3d2311933';
process.env.RPC_URL = 'https://mainnet.infura.io/v3/placeholder';
process.env.TOKEN_DECIMALS = '18';

const { app } = require('../server');

const API_KEY = 'test-key';

const parseJson = (response) => {
  try {
    return JSON.parse(response.text);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}\nRaw response: ${response.text}`);
  }
};

describe('Zealy HODL API (TEST_MODE)', () => {
  afterEach(() => {
    delete process.env.FORCE_TEST_RESULT;
    delete process.env.TEST_ZERO_BALANCE;
  });

  test('POST /zealy/test forceSuccess returns 200 with qualifying message', async () => {
    const response = await request(app)
      .post('/zealy/test')
      .set('x-api-key', API_KEY)
      .send({
        wallet: '0x0000000000000000000000000000000000000001',
        questId: 'balance-tier-1',
        forceSuccess: true
      })
      .expect(200);

    const payload = parseJson(response);
    console.log('Test endpoint success response:', payload);
    expect(payload.message).toContain('User qualifies');
    expect(payload.questId).toBe('balance-tier-1');
    expect(payload.testMode).toBe(true);
  });

  test('POST /zealy/test zeroBalance returns 400 with failure message', async () => {
    const response = await request(app)
      .post('/zealy/test')
      .set('x-api-key', API_KEY)
      .send({
        wallet: '0x0000000000000000000000000000000000000001',
        questId: 'balance-tier-1',
        zeroBalance: true
      })
      .expect(400);

    const payload = parseJson(response);
    console.log('Test endpoint zero balance response:', payload);
    expect(payload.message).toContain("You don't qualify");
    expect(payload.testMode).toBe(true);
    expect(payload.requestedTier?.qualified).toBe(false);
  });

  test('POST /zealy/claim with FORCE_TEST_RESULT=success returns 200', async () => {
    process.env.FORCE_TEST_RESULT = 'success';

    const response = await request(app)
      .post('/zealy/claim')
      .set('x-api-key', API_KEY)
      .send({
        accounts: { wallet: '0x0000000000000000000000000000000000000001' },
        questId: 'balance-tier-1'
      })
      .expect(200);

    const payload = parseJson(response);
    console.log('Claim endpoint forced success response:', payload);
    expect(payload.testMode).toBe(true);
    expect(payload.requestedTier?.qualified).toBe(true);
  });

  test('POST /zealy/claim with FORCE_TEST_RESULT=failure returns 400', async () => {
    process.env.FORCE_TEST_RESULT = 'failure';

    const response = await request(app)
      .post('/zealy/claim')
      .set('x-api-key', API_KEY)
      .send({
        accounts: { wallet: '0x0000000000000000000000000000000000000001' },
        questId: 'balance-tier-1'
      })
      .expect(400);

    const payload = parseJson(response);
    console.log('Claim endpoint forced failure response:', payload);
    expect(payload.testMode).toBe(true);
    expect(payload.requestedTier?.qualified).toBe(false);
  });

  test('POST /zealy/webhook returns 200 when signature matches payload', async () => {
    const payload = {
      id: 'evt_123',
      type: 'quest.completed',
      questId: 'balance-tier-1'
    };
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', process.env.ZEALY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const response = await request(app)
      .post('/zealy/webhook')
      .set('x-zealy-signature', signature)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const result = parseJson(response);
    expect(result.ok).toBe(true);
  });

  test('POST /zealy/webhook returns 401 when signature is invalid', async () => {
    const payload = {
      id: 'evt_bad',
      type: 'quest.completed',
      questId: 'balance-tier-1'
    };
    const body = JSON.stringify(payload);

    await request(app)
      .post('/zealy/webhook')
      .set('x-zealy-signature', 'deadbeef')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);
  });
});

describe('Quest enforcement toggle', () => {
  let enforcedApp;

  beforeAll(async () => {
    jest.resetModules();
    
    process.env.TEST_MODE = 'true';
    process.env.API_KEY = 'test-key';
    process.env.REQUIRE_QUEST_ID = 'true';
    process.env.REQUIRED_QUEST_ID = 'balance-tier-1';
    process.env.ZEALY_WEBHOOK_SECRET = 'super-secret';
    
    process.env.BALANCE_TIER_1_MIN = '100';
    process.env.BALANCE_TIER_1_DAYS = '7';
    process.env.BALANCE_TIER_2_MIN = '1000';
    process.env.BALANCE_TIER_2_DAYS = '14';
    process.env.BALANCE_TIER_3_MIN = '10000';
    process.env.BALANCE_TIER_3_DAYS = '21';
    
    process.env.MIN_HODL_1 = '10';
    process.env.MIN_HODL_2 = '30';
    process.env.MIN_HODL_3 = '100';
    process.env.HODL_TIER_1_DAYS = '7';
    process.env.HODL_TIER_2_DAYS = '30';
    process.env.HODL_TIER_3_DAYS = '90';
    
    process.env.FINAL_TIER_1_MIN = '100';
    process.env.FINAL_TIER_2_MIN = '1000';
    process.env.FINAL_TIER_3_MIN = '10000';
    process.env.FINAL_TIER_1_DAYS = '7';
    process.env.FINAL_TIER_2_DAYS = '30';
    process.env.FINAL_TIER_3_DAYS = '90';
    
    process.env.TOKEN_ADDRESS = '0x6982508145454ce325ddbe47a25d4ec3d2311933';
    process.env.RPC_URL = 'https://mainnet.infura.io/v3/placeholder';
    process.env.TOKEN_DECIMALS = '18';
    
    const mod = require('../server');
    enforcedApp = mod.app;
  });

  afterAll(() => {
    jest.resetModules();
    process.env.REQUIRE_QUEST_ID = 'false';
  });

  const API_KEY = 'test-key';

  test('rejects mismatched questId when enforcement enabled', async () => {
    const response = await request(enforcedApp)
      .post('/zealy/claim')
      .set('x-api-key', API_KEY)
      .send({
        accounts: { wallet: '0x0000000000000000000000000000000000000001' },
        questId: 'balance-tier-2'
      });

    if (response.status !== 400) {
      console.log('Unexpected response status for mismatch test:', response.status);
      console.log('Response body:', response.text);
    }
    expect(response.status).toBe(400);

    const payload = parseJson(response);
    expect(payload.message).toContain('does not match REQUIRED_QUEST_ID');
    expect(payload.expectedQuestId).toBe('balance-tier-1');
    expect(payload.receivedQuestId).toBe('balance-tier-2');
  });

  test('allows matching questId when enforcement enabled', async () => {
    const response = await request(enforcedApp)
      .post('/zealy/claim')
      .set('x-api-key', API_KEY)
      .send({
        accounts: { wallet: '0x0000000000000000000000000000000000000001' },
        questId: 'balance-tier-1'
      });

    if (response.status !== 200) {
      console.log('Unexpected response status:', response.status);
      console.log('Response body:', response.text);
    }
    expect(response.status).toBe(200);

    const payload = parseJson(response);
    expect(payload.requestedTier?.id).toBe('balance-tier-1');
  });
});
