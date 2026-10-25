const ROLES = Object.freeze({
    ADMIN: 'ADMIN',
    RECEPCIONISTA: 'RECEPCIONISTA'
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

module.exports = {
    ROLES,
    ROLE_VALUES
};
