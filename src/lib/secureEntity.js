import { User } from "@/entities/User";

/**
 * Creates a secure wrapper around a Supabase entity that adds
 * authentication and ownership validation.
 *
 * This wrapper enforces auth/ownership checks for write operations
 * (create, update, delete) while passing reads through.
 *
 * @param {object} entity  - An entity object (e.g. entities.Book)
 * @param {object} options
 * @param {string} [options.ownerField='created_by'] - Field used to store the owner identifier
 * @returns {object} Secure entity wrapper
 */
export function createSecureEntity(entity, options = {}) {
  const { ownerField = 'created_by' } = options;

  return {
    // --- Pass-through read operations ---

    list: (filters, sort, limit, offset) =>
      entity.list ? entity.list(filters, sort, limit, offset) : entity.filter(filters, sort, limit, offset),

    filter: (filters, sort, limit, offset) =>
      entity.filter(filters, sort, limit, offset),

    get: (id) => entity.get(id),

    // --- Secured write operations ---

    create: async (data) => {
      const user = await User.me();
      if (!user?.email) throw new Error('Authentication required');
      // Ownership is keyed on the Clerk user id (the `sub` claim in the Supabase
      // JWT), which is what the RLS policies compare `created_by` against.
      // EXCEPTION: entities whose ownerField is the recipient EMAIL (e.g.
      // Notification's `user_email`) must keep storing the email — their RLS
      // policy keys on auth.jwt()->>'email', not on the Clerk id.
      const ownerValue = ownerField === 'user_email' ? user.email : user.id;
      if (!ownerValue) throw new Error('Authentication required');
      return entity.create({ ...data, [ownerField]: ownerValue });
    },

    update: async (id, data) => {
      const user = await User.me();
      if (!user?.email) throw new Error('Authentication required');

      const existing = await entity.get(id);
      // Deny if resource has an owner and it's not the current user.
      // Also deny if owner field is missing (prevents unowned resource bypass).
      const owner = existing[ownerField];
      if (owner && owner !== user.email && owner !== user.id) {
        throw new Error('Not authorized to modify this resource');
      }

      return entity.update(id, data);
    },

    delete: async (id) => {
      const user = await User.me();
      if (!user?.email) throw new Error('Authentication required');

      const existing = await entity.get(id);
      const owner = existing[ownerField];
      if (owner && owner !== user.email && owner !== user.id) {
        throw new Error('Not authorized to delete this resource');
      }

      return entity.delete(id);
    },
  };
}
