const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

// Estos tests necesitan un MongoDB real. En local basta con
// `docker compose up -d mongodb`; en CI lo aporta un service container.
const MONGO_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/auth_test';

process.env.JWT_SECRET = 'secreto_de_prueba';
process.env.REFRESH_TOKEN_SECRET = 'secreto_refresh_de_prueba';

// RabbitMQ y Redis no tienen por que estar levantados para probar el flujo HTTP
jest.mock('../src/messaging/publisher', () => ({
  publishUserEvent: jest.fn().mockResolvedValue(true),
  setupChannel: jest.fn().mockResolvedValue({}),
}));

jest.mock('ioredis', () => {
  const store = new Map();
  return jest.fn().mockImplementation(() => ({
    set: async (key, value) => {
      store.set(key, value);
      return 'OK';
    },
    get: async (key) => (store.has(key) ? store.get(key) : null),
    exists: async (key) => (store.has(key) ? 1 : 0),
    del: async (key) => (store.delete(key) ? 1 : 0),
    quit: async () => 'OK',
  }));
});

const { publishUserEvent } = require('../src/messaging/publisher');
const authRoutes = require('../src/routes/auth');
const User = require('../src/models/User');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  });
  return app;
};

let app;

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
  app = buildApp();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
  jest.clearAllMocks();
});

const nuevoUsuario = {
  name: 'Edgar Ng',
  email: 'edgar@example.com',
  password: 'contrasena123',
};

describe('POST /api/auth/register', () => {
  it('registra un usuario y devuelve sus datos sin la contraseña', async () => {
    const res = await request(app).post('/api/auth/register').send(nuevoUsuario);

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(nuevoUsuario.email);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('guarda la contraseña hasheada, nunca en claro', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);

    const user = await User.findOne({ email: nuevoUsuario.email }).select('+password');
    expect(user.password).not.toBe(nuevoUsuario.password);
    expect(user.password).toMatch(/^\$2[aby]\$/); // formato bcrypt
  });

  it('publica user.created para que el user-service cree el perfil', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);

    expect(publishUserEvent).toHaveBeenCalledWith(
      'user.created',
      expect.objectContaining({ email: nuevoUsuario.email })
    );
  });

  it('rechaza un email ya registrado', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);
    const res = await request(app).post('/api/auth/register').send(nuevoUsuario);

    expect(res.status).toBe(409);
  });

  it('rechaza un email con formato invalido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nuevoUsuario, email: 'esto-no-es-un-email' });

    expect(res.status).toBe(400);
  });

  it('rechaza contraseñas de menos de 6 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nuevoUsuario, password: '123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  // El registro deja emailVerified en false y el login lo exige
  const registrarYVerificar = async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);
    await User.updateOne({ email: nuevoUsuario.email }, { emailVerified: true });
  };

  it('devuelve token y refresh token con credenciales correctas', async () => {
    await registrarYVerificar();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: nuevoUsuario.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rechaza el login si el email no esta verificado', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: nuevoUsuario.password });

    expect(res.status).toBe(401);
  });

  it('rechaza una contraseña incorrecta', async () => {
    await registrarYVerificar();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: 'contrasena_incorrecta' });

    expect(res.status).toBe(401);
  });

  it('no revela si el email existe o no', async () => {
    await registrarYVerificar();

    const inexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'loquesea123' });
    const incorrecta = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: 'contrasena_incorrecta' });

    expect(inexistente.body.message).toBe(incorrecta.body.message);
  });

  it('bloquea la cuenta tras 5 intentos fallidos', async () => {
    await registrarYVerificar();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: nuevoUsuario.email, password: 'incorrecta' });
    }

    const user = await User.findOne({ email: nuevoUsuario.email });
    expect(user.accountLocked).toBe(true);

    // Aunque acierte la contraseña, la cuenta sigue bloqueada
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: nuevoUsuario.email, password: nuevoUsuario.password });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/bloqueada/i);
  });
});
