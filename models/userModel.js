const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userID: { type: Number, required: true, unique: true }, // sequential ID
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  password: { type: String, required: true },
  resetToken: { type: String },
  resetTokenExpire: { type: Date },
  token: { type: String } // authentication token
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema); // Correct model name
