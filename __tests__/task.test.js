const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../index"); // Adjust according to your app entry point

describe("Task API", () => {
  let token;

  beforeAll(async () => {
    // If already connected, do not reconnect
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect("mongodb://localhost:27017/tasks_test", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // Assuming you have a login route to get a valid JWT token
    const res = await request(app).post("/auth/login").send({
      username: "test999",
      password: "testpassword",
    });

    token = res.body.token;
    console.log("Token received:", token); // Add this line
  });

  afterAll(async () => {
    // Disconnect after all tests are done
    await mongoose.disconnect();
  });

  it("should create a new task", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test Task",
        description: "Test Description",
        status: "pending",
        dueDate: "2024-10-10",
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("title", "Test Task");
    expect(res.body).toHaveProperty("description", "Test Description");
    expect(res.body).toHaveProperty("status", "pending");
  });

  it("should fetch tasks by status", async () => {
    const res = await request(app)
      .get("/tasks?status=pending")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.tasks).toBeInstanceOf(Array);
    res.body.tasks.forEach((task) => {
      expect(task.status).toBe("pending");
    });
  });
});
