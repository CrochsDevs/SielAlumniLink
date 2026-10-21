import assert from 'node:assert/strict';
import test from 'node:test';

// No database connections: the model calls below are replaced with test doubles.
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: model } = await import('./tracer.models.js');
const { submitResponse } = await import('./tracer.controllers.js');

test('graduation year is set once while other tracer details remain editable', async (t) => {
  let existing = null;
  let writes = 0;
  t.mock.method(model, 'findByAuthId', async () => existing);
  t.mock.method(model, 'upsertByAuthId', async (_id, data) => {
    writes++;
    existing = data;
    return data;
  });
  const submit = async (body) => {
    const res = {
      status(code) { this.code = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    await submitResponse({ user: { _id: 'test-account', email: 'test@example.test' }, body }, res);
    return res;
  };
  const initial = { batch: '2022', program: 'BS Agriculture', status: 'Unemployed' };
  assert.equal((await submit(initial)).code, 200);
  assert.equal((await submit({ ...initial, status: 'Studying' })).code, 200);
  assert.equal(existing.status, 'Studying');
  assert.equal((await submit({ ...initial, batch: '2023' })).code, 409);
  assert.equal((await submit({ ...initial, program: 'BS Nursing' })).code, 409);
  assert.equal(existing.program, 'BS Agriculture');
  assert.equal(existing.batch, '2022');
  assert.equal(writes, 2);
});
