jest.mock('../models/room', () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn()
}));

const Room = require('../models/room');
const roomService = require('./roomService');

describe('roomService.getAllRooms', () => {
    let sort;

    beforeEach(() => {
        jest.clearAllMocks();
        sort = jest.fn().mockResolvedValue([]);
        Room.find.mockReturnValue({ sort });
    });

    it('lists every room sorted by number when no filter is given', async () => {
        await roomService.getAllRooms();

        expect(Room.find).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ number: 1 });
    });

    it('ignores empty filter values', async () => {
        await roomService.getAllRooms({ status: '', type: '  ', minCapacity: '', minPrice: '', maxPrice: '' });

        expect(Room.find).toHaveBeenCalledWith({});
    });

    it('combines status, capacity and price range filters', async () => {
        await roomService.getAllRooms({
            status: 'disponible',
            minCapacity: '2',
            minPrice: '100',
            maxPrice: '300'
        });

        expect(Room.find).toHaveBeenCalledWith({
            status: 'disponible',
            capacity: { $gte: 2 },
            price: { $gte: 100, $lte: 300 }
        });
    });

    it('supports an open-ended price range', async () => {
        await roomService.getAllRooms({ maxPrice: '250' });

        expect(Room.find).toHaveBeenCalledWith({ price: { $lte: 250 } });
    });

    it('matches the room type exactly, ignoring case and surrounding spaces', async () => {
        await roomService.getAllRooms({ type: ' suite ' });

        const { type } = Room.find.mock.calls[0][0];
        expect(type.test('Suite')).toBe(true);
        expect(type.test('SUITE')).toBe(true);
        expect(type.test('Suite Deluxe')).toBe(false);
    });

    it('treats special characters in the type as plain text', async () => {
        await roomService.getAllRooms({ type: 'Doble (vista)' });

        const { type } = Room.find.mock.calls[0][0];
        expect(type.test('Doble (vista)')).toBe(true);
        expect(type.test('Doble vista')).toBe(false);
    });
});

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
            description: '',
            capacity: undefined,
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

    it('updates a room and checks the changed number against other rooms', async () => {
        const room = { _id: 'room-id', number: '102', type: 'Suite' };
        Room.findOne.mockResolvedValue(null);
        Room.findByIdAndUpdate.mockResolvedValue(room);

        await expect(roomService.updateRoom('room-id', {
            number: ' 102 ',
            type: ' Suite ',
            description: '  Vista al jardín  ',
            capacity: 2,
            price: 200
        })).resolves.toBe(room);

        expect(Room.findOne).toHaveBeenCalledWith({
            number: '102',
            _id: { $ne: 'room-id' }
        });
        expect(Room.findByIdAndUpdate).toHaveBeenCalledWith(
            'room-id',
            {
                $set: {
                    number: '102',
                    type: 'Suite',
                    description: 'Vista al jardín',
                    capacity: 2,
                    price: 200
                }
            },
            { new: true, runValidators: true }
        );
    });

    it('rejects a number assigned to a different room', async () => {
        Room.findOne.mockResolvedValue({ _id: 'other-room', number: '102' });

        await expect(roomService.updateRoom('room-id', {
            number: '102'
        })).rejects.toMatchObject({
            message: 'Ya existe una habitación con ese número',
            statusCode: 409
        });

        expect(Room.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('marks a room as out of service', async () => {
        const room = { _id: 'room-id', status: 'fuera de servicio' };
        Room.findByIdAndUpdate.mockResolvedValue(room);

        await expect(roomService.updateRoom('room-id', {
            status: 'fuera de servicio'
        })).resolves.toBe(room);

        expect(Room.findByIdAndUpdate).toHaveBeenCalledWith(
            'room-id',
            { $set: { status: 'fuera de servicio' } },
            { new: true, runValidators: true }
        );
    });

    it('returns not found when the room does not exist', async () => {
        Room.findByIdAndUpdate.mockResolvedValue(null);

        await expect(roomService.updateRoom('missing-room', {
            price: 200
        })).rejects.toMatchObject({
            message: 'Habitación no encontrada',
            statusCode: 404
        });
    });
});
