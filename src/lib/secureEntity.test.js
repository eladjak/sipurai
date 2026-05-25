import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createSecureEntity } from './secureEntity';

// Mock the User entity so User.me() is controllable
vi.mock('@/entities/User', () => ({
  User: {
    me: vi.fn(),
    updateMyUserData: vi.fn(),
    _setClerkUser: vi.fn(),
    logout: vi.fn(),
  },
}));

import { User } from '@/entities/User';
const mockUserMe = User.me;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Build a minimal fake entity object */
function makeEntity(records = {}) {
  return {
    list: vi.fn(async () => Object.values(records)),
    filter: vi.fn(async () => Object.values(records)),
    get: vi.fn(async (id) => {
      if (records[id] === undefined) throw new Error(`Not found: ${id}`);
      return records[id];
    }),
    create: vi.fn(async (data) => ({ id: 'new_id', ...data })),
    update: vi.fn(async (id, data) => ({ id, ...records[id], ...data })),
    delete: vi.fn(async () => undefined),
  };
}

// ------------------------------------------------------------------
// Authentication tests
// ------------------------------------------------------------------

describe('createSecureEntity — authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when User.me() returns null on create', async () => {
    mockUserMe.mockResolvedValue(null);
    const entity = makeEntity();
    const secure = createSecureEntity(entity);

    await expect(secure.create({ title: 'Book' })).rejects.toThrow('Authentication required');
    expect(entity.create).not.toHaveBeenCalled();
  });

  it('throws when User.me() returns user without email on create', async () => {
    mockUserMe.mockResolvedValue({ id: 'u1' }); // no email
    const entity = makeEntity();
    const secure = createSecureEntity(entity);

    await expect(secure.create({ title: 'Book' })).rejects.toThrow('Authentication required');
  });

  it('allows create when User.me() returns a valid user', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_xyz', email: 'user@example.com' });
    const entity = makeEntity();
    const secure = createSecureEntity(entity);

    const result = await secure.create({ title: 'Book' });
    expect(entity.create).toHaveBeenCalledWith({
      title: 'Book',
      created_by: 'user_xyz',
    });
    expect(result).toMatchObject({ title: 'Book', created_by: 'user_xyz' });
  });

  it('throws when User.me() returns null on update', async () => {
    mockUserMe.mockResolvedValue(null);
    const records = { id1: { id: 'id1', created_by: 'owner@example.com', title: 'Old' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await expect(secure.update('id1', { title: 'New' })).rejects.toThrow('Authentication required');
    expect(entity.update).not.toHaveBeenCalled();
  });

  it('throws when User.me() returns null on delete', async () => {
    mockUserMe.mockResolvedValue(null);
    const records = { id1: { id: 'id1', created_by: 'owner@example.com' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await expect(secure.delete('id1')).rejects.toThrow('Authentication required');
    expect(entity.delete).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// Ownership tests (default ownerField = 'created_by')
// ------------------------------------------------------------------

describe('createSecureEntity — ownership (default ownerField)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks update when current user is not the owner', async () => {
    mockUserMe.mockResolvedValue({ email: 'attacker@example.com' });
    const records = { id1: { id: 'id1', created_by: 'owner@example.com', title: 'Book' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await expect(secure.update('id1', { title: 'Hacked' })).rejects.toThrow(
      'Not authorized to modify this resource'
    );
    expect(entity.update).not.toHaveBeenCalled();
  });

  it('allows update when current user is the owner', async () => {
    mockUserMe.mockResolvedValue({ email: 'owner@example.com' });
    const records = { id1: { id: 'id1', created_by: 'owner@example.com', title: 'Old' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await secure.update('id1', { title: 'New' });
    expect(entity.update).toHaveBeenCalledWith('id1', { title: 'New' });
  });

  it('allows update when ownerField is not set on entity (unowned resource)', async () => {
    mockUserMe.mockResolvedValue({ email: 'anyone@example.com' });
    const records = { id1: { id: 'id1', title: 'Unowned' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await secure.update('id1', { title: 'Updated' });
    expect(entity.update).toHaveBeenCalledWith('id1', { title: 'Updated' });
  });

  it('blocks delete when current user is not the owner', async () => {
    mockUserMe.mockResolvedValue({ email: 'attacker@example.com' });
    const records = { id1: { id: 'id1', created_by: 'owner@example.com' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await expect(secure.delete('id1')).rejects.toThrow(
      'Not authorized to delete this resource'
    );
    expect(entity.delete).not.toHaveBeenCalled();
  });

  it('allows delete when current user is the owner', async () => {
    mockUserMe.mockResolvedValue({ email: 'owner@example.com' });
    const records = { id1: { id: 'id1', created_by: 'owner@example.com' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await secure.delete('id1');
    expect(entity.delete).toHaveBeenCalledWith('id1');
  });
});

// ------------------------------------------------------------------
// Create — automatic owner injection
// ------------------------------------------------------------------

describe('createSecureEntity — create auto-injects owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects created_by = Clerk user id (default ownerField) on create', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_alice', email: 'alice@example.com' });
    const entity = makeEntity();
    const secure = createSecureEntity(entity);

    await secure.create({ title: 'My Book', genre: 'fantasy' });

    expect(entity.create).toHaveBeenCalledWith({
      title: 'My Book',
      genre: 'fantasy',
      created_by: 'user_alice',
    });
  });

  it('does not overwrite existing data keys with the owner field', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_bob', email: 'bob@example.com' });
    const entity = makeEntity();
    const secure = createSecureEntity(entity);

    await secure.create({ title: 'Story', extra: 'value' });

    const call = entity.create.mock.calls[0][0];
    expect(call.title).toBe('Story');
    expect(call.extra).toBe('value');
    expect(call.created_by).toBe('user_bob');
  });

  it('stores the EMAIL (not the id) when ownerField is user_email', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_dave', email: 'dave@example.com' });
    const entity = makeEntity();
    const secure = createSecureEntity(entity, { ownerField: 'user_email' });

    await secure.create({ message: 'X followed you' });

    expect(entity.create).toHaveBeenCalledWith({
      message: 'X followed you',
      user_email: 'dave@example.com',
    });
  });
});

// ------------------------------------------------------------------
// Read pass-through tests (no auth check)
// ------------------------------------------------------------------

describe('createSecureEntity — read operations pass through without auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserMe.mockResolvedValue(null);
  });

  it('list passes through without checking auth', async () => {
    const records = {
      a: { id: 'a', title: 'Book A' },
      b: { id: 'b', title: 'Book B' },
    };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    const result = await secure.list();
    expect(entity.list).toHaveBeenCalled();
    expect(mockUserMe).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('filter passes through without checking auth', async () => {
    const records = { a: { id: 'a', title: 'Book A' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    await secure.filter({ genre: 'fantasy' });
    expect(entity.filter).toHaveBeenCalledWith({ genre: 'fantasy' }, undefined, undefined, undefined);
    expect(mockUserMe).not.toHaveBeenCalled();
  });

  it('get passes through without checking auth', async () => {
    const records = { id1: { id: 'id1', title: 'Book' } };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity);

    const result = await secure.get('id1');
    expect(entity.get).toHaveBeenCalledWith('id1');
    expect(mockUserMe).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'id1', title: 'Book' });
  });
});

// ------------------------------------------------------------------
// Custom ownerField (e.g. UserBadge uses 'user_id')
// ------------------------------------------------------------------

describe('createSecureEntity — custom ownerField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects custom ownerField (user_id) = Clerk id on create', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_carol', email: 'carol@example.com' });
    const entity = makeEntity();
    const secure = createSecureEntity(entity, { ownerField: 'user_id' });

    await secure.create({ badge: 'first-book' });

    expect(entity.create).toHaveBeenCalledWith({
      badge: 'first-book',
      user_id: 'user_carol',
    });
  });

  it('checks custom ownerField on update', async () => {
    mockUserMe.mockResolvedValue({ id: 'user_carol', email: 'carol@example.com' });
    const records = {
      b1: { id: 'b1', user_id: 'user_carol', badge: 'first-book' },
    };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity, { ownerField: 'user_id' });

    await secure.update('b1', { badge: 'updated' });
    expect(entity.update).toHaveBeenCalledWith('b1', { badge: 'updated' });
  });

  it('blocks update when custom ownerField does not match', async () => {
    mockUserMe.mockResolvedValue({ email: 'attacker@example.com' });
    const records = {
      b1: { id: 'b1', user_id: 'carol@example.com', badge: 'first-book' },
    };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity, { ownerField: 'user_id' });

    await expect(secure.update('b1', { badge: 'hacked' })).rejects.toThrow(
      'Not authorized to modify this resource'
    );
  });

  it('checks custom ownerField on delete', async () => {
    mockUserMe.mockResolvedValue({ email: 'carol@example.com' });
    const records = {
      b1: { id: 'b1', user_id: 'carol@example.com' },
    };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity, { ownerField: 'user_id' });

    await secure.delete('b1');
    expect(entity.delete).toHaveBeenCalledWith('b1');
  });

  it('blocks delete when custom ownerField does not match', async () => {
    mockUserMe.mockResolvedValue({ email: 'attacker@example.com' });
    const records = {
      b1: { id: 'b1', user_id: 'carol@example.com' },
    };
    const entity = makeEntity(records);
    const secure = createSecureEntity(entity, { ownerField: 'user_id' });

    await expect(secure.delete('b1')).rejects.toThrow('Not authorized to delete this resource');
  });
});

// ------------------------------------------------------------------
// list fallback: entity without .list uses .filter
// ------------------------------------------------------------------

describe('createSecureEntity — list fallback when entity has no .list()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserMe.mockResolvedValue(null);
  });

  it('falls back to filter when entity.list is undefined', async () => {
    const filterFn = vi.fn(async () => [{ id: 'a' }]);
    const entityWithoutList = {
      filter: filterFn,
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      // no .list property
    };
    const secure = createSecureEntity(entityWithoutList);

    const result = await secure.list({ genre: 'fantasy' }, 'name', 10, 0);
    expect(filterFn).toHaveBeenCalledWith({ genre: 'fantasy' }, 'name', 10, 0);
    expect(result).toHaveLength(1);
  });
});
