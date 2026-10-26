const mongoose = require('mongoose');

const config = require('../config/env');
const User = require('../models/user');
const { ROLES } = require('../constants/roles');

// Crea el administrador que usa la colección Postman. Se usa en CI con una base vacía.
const seedAdmin = async () => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador');
    }

    await mongoose.connect(config.MONGODB_URI);

    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing) {
        console.log(`El administrador ${email} ya existe.`);
        return;
    }

    await User.create({
        name: 'Administrador CI',
        email,
        password,
        role: ROLES.ADMIN
    });

    console.log(`Administrador ${email} creado.`);
};

seedAdmin()
    .catch((error) => {
        console.error('No fue posible crear el administrador:', error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
