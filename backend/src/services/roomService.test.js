jest.mock('../models/room', () => ({
    findOne: jest.fn(),
    create: jest.fn()
}));

const Room = require('../models/room');
const roomService = require('./roomService');

describe('roomService.createRoom', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates a room when its number is not registered', async () => {
        const room = { _id: 'room-id', number: '101' };
        Room.findOne.mockResolvedValue(null);
        Room.create.mockResolvedValue(room);

        await expect(roomService.createRoom({
            number: ' 101 ',
            type: ' Suite ',
            price: 150,
            status: 'disponible'
        })).resolves.toBe(room);

        expect(Room.findOne).toHaveBeenCalledWith({ number: '101' });
        expect(Room.create).toHaveBeenCalledWith({
            number: '101',
            type: 'Suite',
            price: 150,
            status: 'disponible'
        });
    });

    it('rejects a number that already exists', async () => {
        Room.findOne.mockResolvedValue({ number: '101' });

        await expect(roomService.createRoom({
            number: '101',
            type: 'Suite',
            price: 150
        })).rejects.toMatchObject({
            message: 'Ya existe una habitación con ese número',
            statusCode: 409
        });

        expect(Room.create).not.toHaveBeenCalled();
    });

    it('translates a duplicate-key database error into a room conflict', async () => {
        Room.findOne.mockResolvedValue(null);
        Room.create.mockRejectedValue({ code: 11000 });

        await expect(roomService.createRoom({
            number: '101',
            type: 'Suite',
            price: 150
        })).rejects.toMatchObject({
            message: 'Ya existe una habitación con ese número',
            statusCode: 409
        });
    });
});
