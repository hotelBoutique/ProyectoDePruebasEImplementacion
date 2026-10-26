jest.mock('../models/user', () => ({ findById: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../config/env', () => ({ JWT_SECRET: 'unit-test-secret' }));

const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { protect } = require('../middlewares/authMiddleware');

describe('authMiddleware.protect: validación de sesión por versión', () => {
    beforeEach(() => jest.clearAllMocks());

    const request = () => ({ headers: { authorization: 'Bearer unit-token' } });
    const selectUser = user => ({ select: jest.fn().mockResolvedValue(user) });
    const invokeProtect = req => {
        let resolveNext;
        const nextCalled = new Promise(resolve => {
            resolveNext = resolve;
        });
        const next = jest.fn((...args) => resolveNext(args));

        protect(req, {}, next);
        return { next, nextCalled };
    };

    it('rechaza un JWT cuya versión ya fue revocada', async () => {
        jwt.verify.mockReturnValue({ sub: 'user-1', ver: 2 });
        User.findById.mockReturnValue(selectUser({ _id: 'user-1', tokenVersion: 3, isActive: true }));
        const { next, nextCalled } = invokeProtect(request());
        const [error] = await nextCalled;

        expect(User.findById).toHaveBeenCalledWith('user-1');
        expect(error).toEqual(expect.objectContaining({ statusCode: 401 }));
        expect(next).toHaveBeenCalledWith(error);
    });

    it('rechaza cuentas desactivadas aunque el JWT siga vigente', async () => {
        jwt.verify.mockReturnValue({ sub: 'user-1', ver: 0 });
        User.findById.mockReturnValue(selectUser({ _id: 'user-1', tokenVersion: 0, isActive: false }));
        const { next, nextCalled } = invokeProtect(request());
        const [error] = await nextCalled;

        expect(error).toEqual(expect.objectContaining({ statusCode: 403 }));
        expect(next).toHaveBeenCalledWith(error);
    });

    it('adjunta el usuario cuando el token y la versión de sesión coinciden', async () => {
        const user = { _id: 'user-1', tokenVersion: 4, isActive: true };
        jwt.verify.mockReturnValue({ sub: 'user-1', ver: 4 });
        User.findById.mockReturnValue(selectUser(user));
        const req = request();
        const { next, nextCalled } = invokeProtect(req);
        const args = await nextCalled;

        expect(req.user).toBe(user);
        expect(next).toHaveBeenCalledWith();
        expect(args).toEqual([]);
    });
});
