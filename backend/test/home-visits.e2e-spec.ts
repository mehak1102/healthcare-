import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { ServiceArea } from '../src/modules/home-visits/service-area.schema';
import { createTestApp } from './test-app';

const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let areas: Model<ServiceArea>;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_home_visits'));
  areas = app.get(getModelToken(ServiceArea.name));
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('home visits', () => {
  it('reports booking as unavailable', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/home-visits/status`).expect(200);
    expect(res.body.available).toBe(false);
    expect(res.body.pilot.bookingOpen).toBe(false);
    expect(res.body.pilot.pinCodeLookup).toBe(true);
    expect(res.body.message).toMatch(/not open/i);
  });

  it('checks PIN coverage without booking', async () => {
    await request(app.getHttpServer()).get(`${API}/home-visits/pin-coverage?pin=abc`).expect(400);

    const unknown = await request(app.getHttpServer())
      .get(`${API}/home-visits/pin-coverage?pin=110001`)
      .expect(200);
    expect(unknown.body.valid).toBe(true);
    expect(unknown.body.inPilotArea).toBe(false);

    await areas.create({
      pinCode: '560099',
      stateCode: 'KA',
      label: 'E2E test pin',
      active: true,
    });

    const pilot = await request(app.getHttpServer())
      .get(`${API}/home-visits/pin-coverage?pin=560099`)
      .expect(200);
    expect(pilot.body.inPilotArea).toBe(true);
    expect(pilot.body.bookingOpen).toBe(false);
  });
});
