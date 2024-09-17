require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/user");
const Task = require("./models/task");
const authMiddleware = require("./middleware/authMiddleware");
const {
  validateRegister,
  validateLogin,
} = require("./middleware/authValidMiddleware");
const { validateTask } = require("./middleware/taskValidMiddleware");

const app = express();
app.use(express.json());

// Connect to MongoDB (replace with your actual connection string)
mongoose.connect("mongodb://localhost:27017/tms");

// Registration endpoint
app.post("/auth/register", validateRegister, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

// Login endpoint
app.post("/auth/login", validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// get all tasks with userId
app.post("/tasks", authMiddleware, validateTask, async (req, res) => {
  try {
    const { title, description, status, dueDate } = req.body;

    // Create a new task with the userId from the token
    const task = new Task({
      title,
      description,
      status,
      dueDate,
      userId: req.user.userId, // userId is extracted from JWT
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating task", error: error.message });
  }
});

app.get("/tasks", authMiddleware, async (req, res) => {
  try {
    // Pagination, sorting, and filtering query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = "dueDate",
      order = "asc",
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    // Calculate pagination values
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sortOrder = order === "desc" ? -1 : 1; // 1 for ascending, -1 for descending
    const sortField = sortBy === "status" ? "status" : "dueDate"; // Default to 'dueDate'
    const sortCriteria = { [sortField]: sortOrder };

    // Build filter criteria based on query parameters
    const filterCriteria = { userId: req.user.userId }; // Start with filtering by userId

    // If status is provided, add it to the filter
    if (status) {
      filterCriteria.status = status;
    }

    // If startDate and/or endDate are provided, add them to the filter
    if (startDate || endDate) {
      filterCriteria.dueDate = {};
      if (startDate) {
        filterCriteria.dueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filterCriteria.dueDate.$lte = new Date(endDate);
      }
    }

    // If search term is provided, add it to the filter (search in title or description)
    if (search) {
      filterCriteria.$or = [
        { title: { $regex: search, $options: "i" } }, // Case-insensitive search in title
        { description: { $regex: search, $options: "i" } }, // Case-insensitive search in description
      ];
    }

    // Fetch tasks based on filter, pagination, and sorting criteria
    const tasks = await Task.find(filterCriteria)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limitNumber);

    // Get the total number of tasks for pagination metadata
    const totalTasks = await Task.countDocuments(filterCriteria);

    // Send the response with pagination metadata
    res.status(200).json({
      tasks,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalTasks / limitNumber),
      totalTasks,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching tasks", error: error.message });
  }
});

app.get("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching task", error: error.message });
  }
});

app.put("/tasks/:id", authMiddleware, validateTask, async (req, res) => {
  try {
    const { title, description, status, dueDate } = req.body;

    // Find the task and update it
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { title, description, status, dueDate },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating task", error: error.message });
  }
});

app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting task", error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;