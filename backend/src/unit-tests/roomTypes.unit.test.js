const Room = require('../models/room');
const ROOM_TYPES = require('../constants/roomTypes');

describe('Room: tipo de habitación permitido', () => {
    it('usa el catálogo de tipos definidos para validar el modelo', async () => {
        expect(Room.schema.path('type').enumValues).toEqual(ROOM_TYPES);

        const room = new Room({ number: '101', type: 'Suite', price: 150000 });
        await expect(room.validate()).resolves.toBeUndefined();
    });

    it('rechaza tipos que no pertenecen al catálogo', async () => {
        const room = new Room({ number: '101', type: 'Suite Deluxe', price: 150000 });

        await expect(room.validate()).rejects.toMatchObject({
            errors: { type: expect.objectContaining({ name: 'ValidatorError' }) }
        });
    });
});
