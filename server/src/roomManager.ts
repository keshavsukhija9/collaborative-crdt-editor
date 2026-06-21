import { Room } from './room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room();
      this.rooms.set(roomId, room);
    }
    return room;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
