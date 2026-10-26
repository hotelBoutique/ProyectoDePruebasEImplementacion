jest.mock('../models/user', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    create: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'signed-token') }));
jest.mock('../config/env', () => ({ JWT_SECRET: 'unit-test-secret', JWT_EXPIRES_IN: '1h' }));

const User = require('../models/user');
const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const userService = require('../services/userService');
const { ROLES } = require('../constants/roles');

const selectedUser = user => ({ select: jest.fn().mockResolvedValue(user) });

describe('authService: funciones de sesión y perfil', () => {
    beforeEach(() => jest.clearAllMocks());

    it('invalida la sesión incrementando tokenVersion al cerrar sesión', async () => {
        User.findByIdAndUpdate.mockResolvedValue({ _id: 'user-1' });

        await authService.logout('user-1');

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            'user-1',
            { $inc: { tokenVersion: 1 } },
            { new: true }
        );
    });

    it('responde como no autenticado si el usuario ya no existe al cerrar sesión', async () => {
        User.findByIdAndUpdate.mockResolvedValue(null);

        await expect(authService.logout('missing-user')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('actualiza el nombre del perfil sin emitir un token nuevo', async () => {
        const user = { _id: 'user-1', name: 'Antes', save: jest.fn().mockResolvedValue(undefined) };
        User.findById.mockReturnValue(selectedUser(user));

        await expect(authService.updateMyProfile('user-1', { name: 'Después' }))
            .resolves.toEqual({ user });

        expect(user.name).toBe('Después');
        expect(user.save).toHaveBeenCalledTimes(1);
        expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('valida la contraseña actual, incrementa tokenVersion y emite una sesión nueva', async () => {
        const user = {
            _id: { toString: () => 'user-1' },
            tokenVersion: 4,
            password: 'old-hash',
            correctPassword: jest.fn().mockResolvedValue(true),
            save: jest.fn().mockResolvedValue(undefined)
        };
        User.findById.mockReturnValue(selectedUser(user));

        await expect(authService.updateMyProfile('user-1', {
            currentPassword: 'old-password',
            newPassword: 'new-password'
        })).resolves.toEqual({ user, token: 'signed-token' });

        expect(user.correctPassword).toHaveBeenCalledWith('old-password', 'old-hash');
        expect(user.password).toBe('new-password');
        expect(user.tokenVersion).toBe(5);
        expect(jwt.sign).toHaveBeenCalledWith(
            { sub: 'user-1', ver: 5 },
            'unit-test-secret',
            { expiresIn: '1h' }
        );
    });

    it('rechaza el cambio de contraseña cuando la contraseña actual no coincide', async () => {
        const user = {
            password: 'old-hash',
            correctPassword: jest.fn().mockResolvedValue(false),
            save: jest.fn()
        };
        User.findById.mockReturnValue(selectedUser(user));

        await expect(authService.updateMyProfile('user-1', {
            currentPassword: 'wrong',
            newPassword: 'new-password'
        })).rejects.toMatchObject({ statusCode: 400 });

        expect(user.save).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el perfil que se quiere actualizar no existe', async () => {
        User.findById.mockReturnValue(selectedUser(null));

        await expect(authService.updateMyProfile('missing-user', { name: 'Ana' }))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    it('rechaza el inicio de sesión de una cuenta desactivada', async () => {
        const user = {
            isActive: false,
            password: 'hash',
            correctPassword: jest.fn().mockResolvedValue(true)
        };
        User.findOne.mockReturnValue(selectedUser(user));

        await expect(authService.login('ana@example.com', 'secret'))
            .rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('userService: creación y gestión de cuentas', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([
        ['recepcionista', userService.createReceptionist, ROLES.RECEPCIONISTA],
        ['administrador', userService.createAdmin, ROLES.ADMIN]
    ])('crea una cuenta de %s con el rol correcto', async (_label, createAccount, role) => {
        const input = { name: 'Ana', email: 'ana@example.com', password: 'password-123' };
        const created = { _id: 'user-1', ...input, role, isActive: true };
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(created);

        await expect(createAccount(input)).resolves.toBe(created);

        expect(User.create).toHaveBeenCalledWith({ ...input, role, isActive: true });
    });

    it('rechaza crear una cuenta si el correo ya está registrado', async () => {
        User.findOne.mockResolvedValue({ _id: 'existing-user' });

        await expect(userService.createReceptionist({ email: 'ana@example.com' }))
            .rejects.toMatchObject({ statusCode: 409 });

        expect(User.create).not.toHaveBeenCalled();
    });

    it('lista solo recepcionistas y los ordena por nombre y correo', async () => {
        const receptionists = [{ _id: 'user-1' }];
        const sort = jest.fn().mockResolvedValue(receptionists);
        const select = jest.fn().mockReturnValue({ sort });
        User.find.mockReturnValue({ select });

        await expect(userService.getReceptionists()).resolves.toBe(receptionists);

        expect(User.find).toHaveBeenCalledWith({ role: ROLES.RECEPCIONISTA });
        expect(select).toHaveBeenCalledWith('name email role isActive createdAt updatedAt');
        expect(sort).toHaveBeenCalledWith({ name: 1, email: 1 });
    });

    it('cambia el estado de un recepcionista y revoca sus sesiones', async () => {
        const receptionist = { _id: 'user-1', isActive: false };
        const select = jest.fn().mockResolvedValue(receptionist);
        User.findOneAndUpdate.mockReturnValue({ select });

        await expect(userService.setReceptionistStatus('user-1', false)).resolves.toBe(receptionist);

        expect(User.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'user-1', role: ROLES.RECEPCIONISTA },
            { $set: { isActive: false }, $inc: { tokenVersion: 1 } },
            { new: true, runValidators: true }
        );
    });

    it('edita el nombre sin revocar sesiones', async () => {
        const receptionist = { name: 'Antes', tokenVersion: 2, save: jest.fn().mockResolvedValue(undefined) };
        User.findOne.mockReturnValue(selectedUser(receptionist));

        await userService.updateReceptionist('user-1', { name: 'Después' });

        expect(receptionist.name).toBe('Después');
        expect(receptionist.tokenVersion).toBe(2);
        expect(receptionist.save).toHaveBeenCalledTimes(1);
    });

    it('revoca sesiones al cambiar la contraseña o el estado de la cuenta', async () => {
        const receptionist = {
            isActive: true,
            tokenVersion: 2,
            save: jest.fn().mockResolvedValue(undefined)
        };
        User.findOne.mockReturnValue(selectedUser(receptionist));

        await userService.updateReceptionist('user-1', { password: 'new-password', isActive: false });

        expect(receptionist.password).toBe('new-password');
        expect(receptionist.isActive).toBe(false);
        expect(receptionist.tokenVersion).toBe(3);
    });
});
