const { check, validationResult } = require('express-validator');

const validateTask = [
  check('title', 'Title is required').not().isEmpty(),
  check('status', 'Status must be either pending, in-progress, or completed').isIn(['pending', 'in-progress', 'completed']),
  check('dueDate', 'Please provide a valid date').optional().isISO8601(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateTask };
