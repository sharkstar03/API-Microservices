const authorize = require('../src/middleware/authorize');

const ejecutar = (roles, req = {}) => {
  const next = jest.fn();
  authorize(roles)({ params: {}, ...req }, {}, next);
  return next;
};

const permitido = (next) => next.mock.calls[0].length === 0;

describe('authorize', () => {
  it('deja pasar al usuario con el rol exigido', () => {
    const next = ejecutar('admin', { user: { id: '1', role: 'admin' } });
    expect(permitido(next)).toBe(true);
  });

  it('bloquea al usuario con otro rol', () => {
    const next = ejecutar('admin', { user: { id: '1', role: 'user' } });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('acepta una lista de roles', () => {
    const next = ejecutar(['admin', 'premium'], { user: { id: '1', role: 'premium' } });
    expect(permitido(next)).toBe(true);
  });

  it('bloquea si no hay usuario autenticado', () => {
    const next = ejecutar('admin', {});
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('deja pasar las peticiones internas entre servicios', () => {
    const next = ejecutar('admin', { user: { id: 'system', role: 'system', isSystem: true } });
    expect(permitido(next)).toBe(true);
  });

  describe("rol 'self'", () => {
    it('deja al usuario ver sus propias ordenes', () => {
      const next = ejecutar(['admin', 'self'], {
        user: { id: 'abc123', role: 'user' },
        params: { userId: 'abc123' },
      });
      expect(permitido(next)).toBe(true);
    });

    it('impide ver las ordenes de otro usuario', () => {
      const next = ejecutar(['admin', 'self'], {
        user: { id: 'abc123', role: 'user' },
        params: { userId: 'otro-usuario' },
      });
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('no aplica si la ruta no lleva userId', () => {
      const next = ejecutar(['admin', 'self'], {
        user: { id: 'abc123', role: 'user' },
        params: {},
      });
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
