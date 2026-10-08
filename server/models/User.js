const bcrypt = require('bcryptjs');
const { getSupabaseClient } = require('../config/supabase');

/**
 * User Entity Helper Class
 */
class UserEntity {
  constructor(data) {
    this._id = data.id || data._id;
    this.id = data.id || data._id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password;
    this.avatar = data.avatar || '';
    this.bio = data.bio || '';
    this.preferences =
      typeof data.preferences === 'string'
        ? JSON.parse(data.preferences)
        : (data.preferences || { theme: 'dark', emailNotifications: true });
    this.createdAt = data.created_at || data.createdAt || new Date().toISOString();
    this.updatedAt = data.updated_at || data.updatedAt || new Date().toISOString();
  }

  /**
   * Compare candidate password with stored hash
   */
  async comparePassword(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Helper to return safe JSON without password
   */
  toJSON() {
    return {
      _id: this._id,
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      bio: this.bio,
      preferences: this.preferences,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Save changes back to Supabase
   */
  async save() {
    const supabase = getSupabaseClient();
    const updatePayload = {
      name: this.name,
      avatar: this.avatar,
      bio: this.bio,
      preferences: this.preferences,
      updated_at: new Date().toISOString()
    };

    if (this._isPasswordModified && this.password) {
      const salt = await bcrypt.genSalt(10);
      updatePayload.password = await bcrypt.hash(this.password, salt);
      this.password = updatePayload.password;
      this._isPasswordModified = false;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.users" does not exist'))) {
        throw new Error('Supabase "users" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw new Error(`Failed to save user: ${error.message}`);
    }

    if (data) {
      this.updatedAt = data.updated_at;
    }
    return this;
  }
}

class UserModel {
  /**
   * Format raw PostgreSQL record into UserEntity
   */
  static formatUser(row) {
    if (!row) return null;
    return new UserEntity(row);
  }

  /**
   * Create a new user record in Supabase PostgreSQL
   */
  static async create({ name, email, password, avatar, bio, preferences }) {
    const supabase = getSupabaseClient();
    const cleanEmail = email.trim().toLowerCase();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultAvatar =
      avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        name
      )}&backgroundColor=4f46e5,06b6d4,3b82f6`;

    const userRecord = {
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      avatar: defaultAvatar,
      bio: bio || '',
      preferences: preferences || { theme: 'dark', emailNotifications: true }
    };

    const { data, error } = await supabase
      .from('users')
      .insert(userRecord)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        const customErr = new Error('An account with this email address already exists');
        customErr.code = 11000;
        customErr.statusCode = 409;
        throw customErr;
      }
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.users" does not exist'))) {
        throw new Error('Supabase "users" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      throw error;
    }

    return this.formatUser(data);
  }

  /**
   * Find a user by email
   */
  static async findOne(query) {
    const supabase = getSupabaseClient();
    let queryBuilder = supabase.from('users').select('*');

    if (query.email) {
      queryBuilder = queryBuilder.eq('email', query.email.trim().toLowerCase());
    }
    if (query._id || query.id) {
      queryBuilder = queryBuilder.eq('id', query._id || query.id);
    }

    const { data, error } = await queryBuilder.maybeSingle();
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.users" does not exist'))) {
        throw new Error('Supabase "users" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    if (!data) return null;

    const user = this.formatUser(data);

    // Provide chained .select() emulation for compatibility
    return {
      ...user,
      select: (fields) => user,
      then: (resolve) => resolve(user)
    };
  }

  /**
   * Find a user by ID
   */
  static async findById(id) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('relation "public.users" does not exist'))) {
        throw new Error('Supabase "users" table not found. Please run supabase/schema.sql in your Supabase SQL Editor.');
      }
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    if (!data) return null;

    const user = this.formatUser(data);
    return user;
  }
}

module.exports = UserModel;
