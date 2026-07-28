/**
 * Optional live API smoke test for orderless goods receipt payload.
 * Usage:
 *   $env:WMS_TEST_USER="your-user"
 *   $env:WMS_TEST_PASSWORD="your-password"
 *   npm run test:manual-gr:api
 */
const API_URL = process.env.WMS_API_URL ?? 'http://localhost:5234';
const USER = process.env.WMS_TEST_USER;
const PASSWORD = process.env.WMS_TEST_PASSWORD;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login() {
  assert(USER && PASSWORD, 'WMS_TEST_USER and WMS_TEST_PASSWORD env vars are required for live API test.');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: USER, password: PASSWORD }),
  });
  const body = await response.json();
  assert(response.ok && body.data?.accessToken, body.message ?? `Login failed (${response.status})`);
  return body.data.accessToken;
}

async function resolveTrackingPolicy(token, stockId) {
  const response = await fetch(`${API_URL}/api/stock-tracking-policies/resolve?branchCode=0&stockId=${stockId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  assert(response.ok && body.success, body.message ?? `Tracking policy failed (${response.status})`);
  return body.data ?? {};
}

async function createOrderless(token, serialNo) {
  const payload = {
    idempotencyKey: crypto.randomUUID(),
    branchCode: '0',
    documentSeriesId: 15,
    supplierId: 20,
    targetWarehouseId: 1,
    receivingLocationId: 26,
    documentDate: '2026-07-29',
    waybillNo: `${Date.now()}`.slice(-15).padStart(15, '0'),
    waybillDate: '2026-07-29',
    electronicWaybillNo: null,
    shipmentReferenceNo: null,
    carrierCode: null,
    carrierName: null,
    vehiclePlate: null,
    trailerPlate: null,
    driverName: null,
    sealNo: null,
    plannedArrivalAtUtc: null,
    occurredAtUtc: null,
    labelStrategy: 'None',
    executionMode: 'Manual',
    priority: 3,
    deviceId: null,
    description: 'manual-gr api smoke test',
    assignedUserIds: [1],
    lines: [{
      stockId: 1,
      yapCodeId: null,
      quantity: 1,
      unitCode: 'AD',
      trackingType: 'Serial',
      trackings: serialNo ? [{ quantity: 1, lotNo: null, serialNo, manufacturingDate: null, expirationDate: null, description: null }] : [],
      lotNo: null,
      serialNo,
      manufacturingDate: null,
      expirationDate: null,
      scannedBarcode: null,
      goodsReceiptLabelId: null,
      description: null,
      targetWarehouseId: 1,
      receivingLocationId: 26,
    }],
  };

  return fetch(`${API_URL}/api/goods-receipts/orderless`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function main() {
  if (!USER || !PASSWORD) {
    console.log('SKIP live API test: set WMS_TEST_USER and WMS_TEST_PASSWORD to run against localhost backend.');
    return;
  }

  const token = await login();
  const policy = await resolveTrackingPolicy(token, 1);
  console.log(`Stock 1 tracking policy: ${policy.trackingType ?? 'unknown'}`);

  const withoutSerial = await createOrderless(token, null);
  const withoutSerialBody = await withoutSerial.json();
  assert(!withoutSerialBody.success && withoutSerial.status === 400, `Expected 400 without serial, got ${withoutSerial.status}: ${withoutSerialBody.message ?? ''}`);
  console.log('OK rejects missing serial with 400');

  const serialNo = `TEST-${Date.now()}`;
  const withSerial = await createOrderless(token, serialNo);
  const withSerialBody = await withSerial.json();
  assert(withSerial.ok && withSerialBody.success, withSerialBody.message ?? `Expected success with serial, got ${withSerial.status}`);
  console.log(`OK created orderless receipt: ${withSerialBody.data?.documentNo ?? '(no document no)'}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
