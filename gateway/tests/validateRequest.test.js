const { validationResult } = require('express-validator');
const validateRequest = require('../src/middleware/validateRequest');

jest.mock('express-validator', () => ({ validationResult: jest.fn() }));

const construirRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('validateRequest', () => {
  it('continua cuando no hay errores de validacion', () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const res = construirRes();
    const next = jest.fn();

    validateRequest({}, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 400 con el detalle de cada campo invalido', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ param: 'email', msg: 'El email no es válido' }],
    });
    const res = construirRes();
    const next = jest.fn();

    validateRequest({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      errors: [{ field: 'email', message: 'El email no es válido' }],
    });
  });
});
