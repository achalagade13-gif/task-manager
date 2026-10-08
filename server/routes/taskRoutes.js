const express = require('express');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateObjectId,
  validateTask,
  validateTaskStatus
} = require('../middleware/validationMiddleware');

const router = express.Router();

// All task routes require authentication
router.use(protect);

// Dashboard stats endpoint
router.get('/stats/dashboard', getTaskStats);

// Task CRUD
router.route('/')
  .get(getTasks)
  .post(validateTask(false), createTask);

router.route('/:id')
  .get(validateObjectId('id'), getTaskById)
  .put(validateObjectId('id'), validateTask(true), updateTask)
  .delete(validateObjectId('id'), deleteTask);

router.patch('/:id/status', validateObjectId('id'), validateTaskStatus, updateTaskStatus);

module.exports = router;
