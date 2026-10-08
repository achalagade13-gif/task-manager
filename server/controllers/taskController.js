const Task = require('../models/Task');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * @desc    Create a new task for the authenticated user
 * @route   POST /api/tasks
 * @access  Private
 */
const createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate, tags, subtasks } = req.body;

    const task = await Task.create({
      userId: req.user._id,
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      tags: tags || [],
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      completedAt: status === 'completed' ? new Date() : null
    });

    return successResponse(res, 201, 'Task created successfully', { task });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all tasks for authenticated user with search, filter, and sorting
 * @route   GET /api/tasks
 * @access  Private
 */
const getTasks = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      tag,
      search,
      sort = 'newest',
      page = 1,
      limit = 50,
      timeframe
    } = req.query;

    const query = { userId: req.user._id };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'overdue') {
        query.status = { $ne: 'completed' };
        query.dueDate = { $lt: new Date() };
      } else if (status === 'pending') {
        query.status = { $in: ['todo', 'in-progress'] };
      } else {
        query.status = status;
      }
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Tag filter
    if (tag && tag !== 'all') {
      query.tags = tag.toLowerCase().trim();
    }

    // Timeframe filters (today, this-week, upcoming)
    if (timeframe) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (timeframe === 'today') {
        query.dueDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (timeframe === 'this-week') {
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        query.dueDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (timeframe === 'overdue') {
        query.status = { $ne: 'completed' };
        query.dueDate = { $lt: startOfDay };
      }
    }

    // Text Search (title, description, tags)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    // Determine Sort options
    let sortOptions = { createdAt: -1 }; // default newest

    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sort === 'dueDate') {
      sortOptions = { dueDate: 1, createdAt: -1 };
    } else if (sort === 'title') {
      sortOptions = { title: 1 };
    } else if (sort === 'priority') {
      sortOptions = { priority: 1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Task.countDocuments(query)
    ]);

    // Priority sorting order refinement (Urgent > High > Medium > Low)
    if (sort === 'priority') {
      const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
      tasks.sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 0;
        const weightB = priorityWeights[b.priority] || 0;
        return weightB - weightA;
      });
    }

    const meta = {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    };

    return successResponse(res, 200, 'Tasks retrieved successfully', { tasks }, meta);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private
 */
const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    return successResponse(res, 200, 'Task retrieved successfully', { task });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:id
 * @access  Private
 */
const updateTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate, tags, subtasks } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
    if (tags !== undefined) task.tags = tags;
    if (subtasks !== undefined && Array.isArray(subtasks)) task.subtasks = subtasks;

    if (status !== undefined) {
      if (status === 'completed' && task.status !== 'completed') {
        task.completedAt = new Date().toISOString();
      } else if (status !== 'completed' && task.status === 'completed') {
        task.completedAt = null;
      }
      task.status = status;
    }

    await task.save();

    return successResponse(res, 200, 'Task updated successfully', { task });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Quick update task status (todo | in-progress | completed)
 * @route   PATCH /api/tasks/:id/status
 * @access  Private
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    task.status = status;
    task.completedAt = status === 'completed' ? new Date().toISOString() : null;

    await task.save();

    return successResponse(res, 200, `Task status updated to ${status}`, { task });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete task permanently
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }

    return successResponse(res, 200, 'Task deleted successfully', {
      deletedTaskId: req.params.id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard metrics & statistical breakdown
 * @route   GET /api/tasks/stats/dashboard
 * @access  Private
 */
const getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [
      totalTasks,
      completedTasks,
      todoTasks,
      inProgressTasks,
      overdueTasks,
      highPriorityTasks,
      dueTodayTasks,
      dueThisWeekTasks,
      allTags,
      recentTasks,
      todayTaskList
    ] = await Promise.all([
      Task.countDocuments({ userId }),
      Task.countDocuments({ userId, status: 'completed' }),
      Task.countDocuments({ userId, status: 'todo' }),
      Task.countDocuments({ userId, status: 'in-progress' }),
      Task.countDocuments({
        userId,
        status: { $ne: 'completed' },
        dueDate: { $lt: startOfDay }
      }),
      Task.countDocuments({
        userId,
        priority: { $in: ['high', 'urgent'] }
      }),
      Task.countDocuments({
        userId,
        dueDate: { $gte: startOfDay, $lte: endOfDay }
      }),
      Task.countDocuments({
        userId,
        dueDate: { $gte: startOfWeek, $lte: endOfWeek }
      }),
      Task.distinct('tags', { userId }),
      Task.find({ userId }).sort({ createdAt: -1 }).limit(5),
      Task.find({
        userId,
        dueDate: { $gte: startOfDay, $lte: endOfDay }
      }).limit(50)
    ]);

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const stats = {
      total: totalTasks,
      completed: completedTasks,
      todo: todoTasks,
      inProgress: inProgressTasks,
      pending: todoTasks + inProgressTasks,
      overdue: overdueTasks,
      highPriority: highPriorityTasks,
      dueToday: dueTodayTasks,
      dueThisWeek: dueThisWeekTasks,
      completionRate,
      tags: (allTags || []).filter(Boolean),
      recentTasks,
      todayTaskList
    };

    return successResponse(res, 200, 'Dashboard statistics retrieved', { stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats
};
