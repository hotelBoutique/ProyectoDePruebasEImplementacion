const User = require('../models/user');
const { ROLES, ROLE_VALUES } = require('../constants/roles');

describe('User: roles y versión de sesión', () => {
    it('acepta únicamente los roles definidos y usa recepcionista como valor predeterminado', () => {
        const rolePath = User.schema.path('role');

        expect(rolePath.enumValues).toEqual(ROLE_VALUES);
        expect(rolePath.defaultValue).toBe(ROLES.RECEPCIONISTA);
    });

    it('mantiene tokenVersion fuera de las respuestas JSON por defecto', () => {
        const tokenVersionPath = User.schema.path('tokenVersion');
        const user = new User({
            name: 'Ana',
            email: 'ana@example.com',
            password: 'password-123',
            tokenVersion: 4
        });

        expect(tokenVersionPath.defaultValue).toBe(0);
        expect(tokenVersionPath.options.select).toBe(false);
        expect(user.toJSON()).not.toHaveProperty('tokenVersion');
    });
});
