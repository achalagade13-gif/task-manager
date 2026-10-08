const { getSupabaseClient } = require('../config/supabase');

/**
 * Task Entity Helper Class
 */
class TaskEntity {
  constructor(data) {
    this._id = data.id || data._id;
    this.id = data.id || data._id;
    this.userId = data.user_id || data.userId;
    this.title = data.title;
    this.description = data.description || '';
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.dueDate = data.due_date ? new Date(data.due_date).toISOString() : (data.dueDate || null);
    this.tags = Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];
    this.completedAt = data.completed_at ? new Date(data.completed_at).toISOString() : (data.completedAt || null);
    this.subtasks =
      typeof data.subtasks === 'string'
        ? JSON.parse(data.subtasks)
        : (data.subtasks || []);
    this.createdAt = data.created_at ? new Date(data.created_at).toISOString() : (data.createdAt || new Date().toISOString());
    this.updatedAt = data.updated_at ? new Date(data.updated_at).toISOString() : (data.updatedAt || new Date().toISOString());
  }

  toJSON() {
    return {
      _id: this._id,
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      dueDate: this.dueDate,
      tags: this.tags,
      completedAt: this.completedAt,
      subtasks: this.subtasks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const supabase = getSupabaseClient();
    const updatePayload = {
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      due_date: this.dueDate,
      tags: this.tags,
      completed_at: this.completedAt,
      subtasks: this.subtasks,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', this.id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw new Error(`Failed to update task: ${error.message}`);
    }

    if (data) {
      this.updatedAt = data.updated_at;
    }
    return this;
  }
}

class TaskQueryBuilder {
  constructor(query = {}) {
    this.query = query;
    this.sortConfig = { column: 'created_at', ascending: false };
    this.skipCount = 0;
    this.limitCount = null;
    this.customPrioritySort = false;
  }

  sort(sortOptions) {
    if (typeof sortOptions === 'object') {
      if (sortOptions.createdAt === 1) {
        this.sortConfig = { column: 'created_at', ascending: true };
      } else if (sortOptions.createdAt === -1) {
        this.sortConfig = { column: 'created_at', ascending: false };
      } else if (sortOptions.dueDate) {
        this.sortConfig = { column: 'due_date', ascending: true };
      } else if (sortOptions.title) {
        this.sortConfig = { column: 'title', ascending: true };
      } else if (sortOptions.priority) {
        this.customPrioritySort = true;
        this.sortConfig = { column: 'created_at', ascending: false };
      }
    }
    return this;
  }

  skip(count) {
    this.skipCount = count;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  lean() {
    return this;
  }

  async execute() {
    const supabase = getSupabaseClient();
    let queryBuilder = supabase.from('tasks').select('*');

    // Apply filters from this.query
    queryBuilder = TaskModel.applyFilters(queryBuilder, this.query);

    // Apply ordering
    if (this.sortConfig) {
      queryBuilder = queryBuilder.order(this.sortConfig.column, {
        ascending: this.sortConfig.ascending
      });
    }

    // Apply pagination range if limit is set
    if (this.limitCount !== null) {
      const from = this.skipCount;
      const to = this.skipCount + this.limitCount - 1;
      queryBuilder = queryBuilder.range(from, to);
    }

    const { data, error } = await queryBuilder;
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw error;
    }

    let results = (data || []).map((row) => TaskModel.formatTask(row).toJSON());

    if (this.customPrioritySort) {
      const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
      results.sort((a, b) => (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0));
    }

    return results;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

class TaskModel {
  static formatTask(row) {
    if (!row) return null;
    return new TaskEntity(row);
  }

  static applyFilters(builder, query) {
    let q = builder;

    if (query.userId || query.user_id) {
      q = q.eq('user_id', query.userId || query.user_id);
    }

    if (query._id || query.id) {
      q = q.eq('id', query._id || query.id);
    }

    // Status filter
    if (query.status) {
      if (typeof query.status === 'string') {
        q = q.eq('status', query.status);
      } else if (query.status.$in) {
        q = q.in('status', query.status.$in);
      } else if (query.status.$ne) {
        q = q.neq('status', query.status.$ne);
      }
    }

    // Priority filter
    if (query.priority) {
      if (typeof query.priority === 'string') {
        q = q.eq('priority', query.priority);
      } else if (query.priority.$in) {
        q = q.in('priority', query.priority.$in);
      }
    }

    // Tag filter
    if (query.tags) {
      if (typeof query.tags === 'string') {
        q = q.contains('tags', [query.tags.toLowerCase().trim()]);
      }
    }

    // Due date filter
    if (query.dueDate) {
      if (query.dueDate.$lt) {
        const d = query.dueDate.$lt instanceof Date ? query.dueDate.$lt.toISOString() : query.dueDate.$lt;
        q = q.lt('due_date', d);
      }
      if (query.dueDate.$gte) {
        const d = query.dueDate.$gte instanceof Date ? query.dueDate.$gte.toISOString() : query.dueDate.$gte;
        q = q.gte('due_date', d);
      }
      if (query.dueDate.$lte) {
        const d = query.dueDate.$lte instanceof Date ? query.dueDate.$lte.toISOString() : query.dueDate.$lte;
        q = q.lte('due_date', d);
      }
    }

    // Text search filter (title, description, tags)
    if (query.$or && Array.isArray(query.$or)) {
      const searchTerms = [];
      for (const condition of query.$or) {
        if (condition.title && condition.title.source) {
          searchTerms.push(`title.ilike.%${condition.title.source}%`);
          searchTerms.push(`description.ilike.%${condition.title.source}%`);
        } else if (typeof condition.title === 'string') {
          searchTerms.push(`title.ilike.%${condition.title}%`);
        }
      }
      if (searchTerms.length > 0) {
        q = q.or(searchTerms.join(','));
      }
    }

    return q;
  }

  /**
   * Create a new task in Supabase PostgreSQL
   */
  static async create({ userId, title, description, status, priority, dueDate, tags, subtasks, completedAt }) {
    const supabase = getSupabaseClient();
    const formattedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];

    const taskRecord = {
      user_id: userId,
      title: title.trim(),
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      tags: formattedTags,
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      completed_at: completedAt ? new Date(completedAt).toISOString() : (status === 'completed' ? new Date().toISOString() : null)
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskRecord)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw error;
    }

    return this.formatTask(data);
  }

  /**
   * Find tasks with chaining support (.sort, .skip, .limit, .lean)
   */
  static find(query = {}) {
    return new TaskQueryBuilder(query);
  }

  /**
   * Count documents matching query
   */
  static async countDocuments(query = {}) {
    const supabase = getSupabaseClient();
    let queryBuilder = supabase.from('tasks').select('*', { count: 'exact', head: true });

    queryBuilder = this.applyFilters(queryBuilder, query);

    const { count, error } = await queryBuilder;
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw error;
    }

    return count || 0;
  }

  /**
   * Find single task by query
   */
  static async findOne(query = {}) {
    const supabase = getSupabaseClient();
    let queryBuilder = supabase.from('tasks').select('*');

    queryBuilder = this.applyFilters(queryBuilder, query);

    const { data, error } = await queryBuilder.maybeSingle();
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    if (!data) return null;
    return this.formatTask(data);
  }

  /**
   * Find single task and delete
   */
  static async findOneAndDelete(query = {}) {
    const supabase = getSupabaseClient();
    const existing = await this.findOne(query);
    if (!existing) return null;

    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', existing.id)
      .eq('user_id', existing.userId)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    return existing;
  }

  /**
   * Get distinct tags for user
   */
  static async distinct(field, query = {}) {
    if (field !== 'tags') return [];
    const supabase = getSupabaseClient();
    const userId = query.userId || query.user_id;

    let queryBuilder = supabase.from('tasks').select('tags');
    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }

    const { data, error } = await queryBuilder;
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.tasks" does not exist'))) {
        throw new Error('Supabase "tasks" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw error;
    }

    const tagSet = new Set();
    for (const row of data || []) {
      if (Array.isArray(row.tags)) {
        row.tags.forEach((t) => tagSet.add(t));
      }
    }

    return Array.from(tagSet);
  }
}

module.exports = TaskModel;
