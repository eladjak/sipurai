/**
 * Supabase Entity Adapter — drop-in replacement for Base44 entities.
 *
 * Provides the same API shape as Base44 entities:
 *   { list, filter, get, create, update, delete }
 *
 * Sort format: "-field" = descending, "field" = ascending (same as Base44)
 * Filter format: { field: value } for exact match (same as Base44)
 */

import { supabase } from './supabaseClient';
import { toAppImageUrl } from './imageUrl';

// Columns that hold image URLs. A row written before the bucket went private may still carry the old
// public URL; on every read it is mapped to the /api/img proxy form.
const IMAGE_COLUMNS = ['cover_image', 'image_url', 'primary_image_url', 'avatar_url'];

/**
 * Parse Base44-style sort string into Supabase order params.
 * "-created_date" → { column: "created_date", ascending: false }
 * "page_number"   → { column: "page_number", ascending: true }
 */
function parseSort(sort) {
  if (!sort) return null;
  if (sort.startsWith('-')) {
    return { column: sort.slice(1), ascending: false };
  }
  return { column: sort, ascending: true };
}

/**
 * Create a Supabase-backed entity with the same API as Base44 entities.
 *
 * @param {string} tableName - PostgreSQL table name (e.g. 'books', 'pages')
 * @param {Object} [options]
 * @param {Object} [options.columnMap] - Map of app field names to DB column names
 *   e.g. { childNames: 'child_names', selectedCharacters: 'selected_characters' }
 */
export function createSupabaseEntity(tableName, { columnMap = {} } = {}) {
  // Build reverse map: DB column → app field
  const reverseMap = {};
  for (const [appKey, dbCol] of Object.entries(columnMap)) {
    reverseMap[dbCol] = appKey;
  }

  /** Convert app-side data to DB columns */
  function toDb(data) {
    if (!data || Object.keys(columnMap).length === 0) return data;
    const result = { ...data };
    for (const [appKey, dbCol] of Object.entries(columnMap)) {
      if (appKey in result) {
        result[dbCol] = result[appKey];
        delete result[appKey];
      }
    }
    return result;
  }

  /** Convert DB row to app-side field names */
  function toApp(row) {
    if (!row) return row;
    let result = row;
    for (const col of IMAGE_COLUMNS) {
      if (typeof result[col] === 'string' && toAppImageUrl(result[col]) !== result[col]) {
        result = { ...result, [col]: toAppImageUrl(result[col]) };
      }
    }
    if (Object.keys(reverseMap).length === 0) return result;
    result = { ...result };
    for (const [dbCol, appKey] of Object.entries(reverseMap)) {
      if (dbCol in result) {
        result[appKey] = result[dbCol];
        delete result[dbCol];
      }
    }
    return result;
  }

  /** Convert filter keys from app names to DB column names */
  function mapFilterKeys(filters) {
    if (!filters || Object.keys(columnMap).length === 0) return filters;
    const result = {};
    for (const [key, value] of Object.entries(filters)) {
      result[columnMap[key] || key] = value;
    }
    return result;
  }

  /** Map sort field name */
  function mapSortField(sort) {
    if (!sort) return sort;
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    const mapped = columnMap[field] || field;
    return desc ? `-${mapped}` : mapped;
  }

  return {
    /**
     * List all records (optionally sorted, limited, offset).
     * Signature matches Base44: list(sort?, limit?, offset?)
     */
    async list(sort, limit, offset) {
      let query = supabase.from(tableName).select('*');

      const sortParam = parseSort(mapSortField(sort));
      if (sortParam) {
        query = query.order(sortParam.column, { ascending: sortParam.ascending });
      }

      if (limit) {
        const start = offset || 0;
        query = query.range(start, start + limit - 1);
      }

      const { data, error } = await query;
      if (error) throw new Error(`${tableName}.list failed: ${error.message}`);
      return (data || []).map(toApp);
    },

    /**
     * Filter records by exact match on fields.
     * Signature matches Base44: filter(filters, sort?, limit?, offset?)
     */
    async filter(filters, sort, limit, offset) {
      let query = supabase.from(tableName).select('*');

      const mappedFilters = mapFilterKeys(filters);
      if (mappedFilters) {
        for (const [key, value] of Object.entries(mappedFilters)) {
          query = query.eq(key, value);
        }
      }

      const sortParam = parseSort(mapSortField(sort));
      if (sortParam) {
        query = query.order(sortParam.column, { ascending: sortParam.ascending });
      }

      if (limit) {
        const start = offset || 0;
        query = query.range(start, start + limit - 1);
      }

      const { data, error } = await query;
      if (error) throw new Error(`${tableName}.filter failed: ${error.message}`);
      return (data || []).map(toApp);
    },

    /**
     * Get a single record by ID.
     */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(`${tableName}.get failed: ${error.message}`);
      return toApp(data);
    },

    /**
     * Create a new record. Returns the created record with its generated ID.
     */
    async create(data) {
      const { data: created, error } = await supabase
        .from(tableName)
        .insert(toDb(data))
        .select()
        .single();
      if (error) throw new Error(`${tableName}.create failed: ${error.message}`);
      return toApp(created);
    },

    /**
     * Update a record by ID. Returns the updated record.
     */
    async update(id, data) {
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(toDb(data))
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`${tableName}.update failed: ${error.message}`);
      return toApp(updated);
    },

    /**
     * Delete a record by ID.
     */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw new Error(`${tableName}.delete failed: ${error.message}`);
    },
  };
}
