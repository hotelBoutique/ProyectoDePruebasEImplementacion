const mongoose = require('mongoose');

const config = require('../config/env');
const User = require('../models/user');
const { ROLES } = require('../constants/roles');

const migrations = [
    {
        filter: { role: 'admin' },
        role: ROLES.ADMIN,
        label: 'admin → ADMIN'
    },
    {
        filter: { role: 'user' },
        role: ROLES.RECEPCIONISTA,
        label: 'user → RECEPCIONISTA'
    },
    {
        // MongoDB también considera los documentos sin role al buscar null.
        filter: { role: null },
        role: ROLES.RECEPCIONISTA,
        label: 'role vacío → RECEPCIONISTA'
    }
];

const migrateUserRoles = async () => {
    await mongoose.connect(config.MONGODB_URI);

    for (const migration of migrations) {
        const result = await User.updateMany(
            migration.filter,
            { $set: { role: migration.role } }
        );

        console.log(`${migration.label}: ${result.modifiedCount} usuario(s) actualizado(s)`);
    }

    console.log('Migración de roles finalizada.');
};

const run = async () => {
    try {
        await migrateUserRoles();
    } catch (error) {
        console.error('No fue posible migrar los roles de usuario:', error);
        process.exitCode = 1;
    } finally {
        try {
            await mongoose.disconnect();
        } catch (error) {
            console.error('No fue posible cerrar la conexión con MongoDB:', error);
            process.exitCode = 1;
        }
    }
};

run();
