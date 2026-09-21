const authorize = require('../src/middleware/authorize');

const ejecutar = (roles, req = {}) => {
  const next = jest.fn();
  authorize(roles)({ params: {}, ...req }, {}, next);
  return next;
};

const permitido = (next) => next.mock.calls[0].length === 0;

describe('authorize', () => {
  it('deja pasar al admin', () => {
    const next = ejecutar(['admin'], { user: { id: '1', role: 'admin' } });
    expect(permitido(next)).toBe(true);
  });

  it('bloquea a un usuario normal', () => {
    const next = ejecutar(['admin'], { user: { id: '1', role: 'user' } });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('bloquea si no hay usuario autenticado', () => {
    const next = ejecutar(['admin'], {});
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('deja pasar las peticiones internas entre servicios', () => {
    const next = ejecutar(['admin'], { user: { id: 'system', role: 'system', isSystem: true } });
    expect(permitido(next)).toBe(true);
  });

  // Este servicio no tiene coleccion de usuarios, asi que 'self' no aplica:
  // se comprueba unicamente el rol del token.
  it("no concede acceso por 'self' aunque coincida el id", () => {
    const next = ejecutar(['admin', 'self'], {
      user: { id: 'abc123', role: 'user' },
      params: { userId: 'abc123' },
    });
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
