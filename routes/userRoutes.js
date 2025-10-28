const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const counter = require('../models/counterModel');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');






// ✅ CREATE USER
router.post('/register', async (req, res) => {
  const { name, email, age, password } = req.body;

  if (!name || !email || !age || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email, age, and password are required"
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const counterDoc = await counter.findOneAndUpdate(
      { id: 'userID' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const user = new User({ userID: counterDoc.seq, name, email, age, password: hashedPassword });
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: err.message
    });
  }
});


// login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false, 
        message: "Invalid credentials"
      });
    }



// login successful, generate token
    const token = jwt.sign({ id: user.userID }, process.env.JWT_SECRET, { expiresIn: '1d' });
    user.token = token;
    await user.save();

    res.status(200).json({
      status: 200,
      success: true,
      message: "User logged in successfully",
      data: {
        id: user.userID,
        name: user.name,
        email: user.email,
        age: user.age,
        token,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
      
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error logging in user",
      error: err.message
    });
  }
});
 

  // forgot password route
router.post('/forgot-password',async (req, res) => {
  const { email } = req.body; 
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({   
        success: false,
        message: "User not found"
      });
    }

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpire = new Date(Date.now() + 3600000); // 1 hour from now
    user.resetToken = resetToken;
    user.resetTokenExpire = resetTokenExpire;
    await user.save();

    // In real app, send this token via email to user
    res.status(200).json({
      success: true,    
      message: "Password reset token generated",
      data: {
        resetToken,
        resetTokenExpire
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error generating reset token",
      error: err.message
    });
  } 
});

// 🔒 RESET PASSWORD

router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body; 

  console.log("🔹 Reset password request received");
  console.log("Reset Token:", resetToken);
  console.log("New Password:", newPassword ? "********" : null);

  if (!resetToken || !newPassword) {
    console.log("❌ Missing resetToken or newPassword");
    return res.status(400).json({
      success: false,
      message: "Reset token and new password are required"
    });
  }

  try {
    // ✅ Find by token first
    const user = await User.findOne({ resetToken });
    console.log("User found:", user ? user.email : null);

    if (!user || user.resetTokenExpire < new Date()) {
      console.log("❌ Invalid or expired reset token");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    console.log("✅ User password updated successfully");

    res.status(200).json({
      success: true,
      message: "Password reset successful"
    });

  } catch (err) {
    console.error("❌ Error resetting password:", err.message);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: err.message
    });
  }
});


// token protected route
router.get(
  '/me', authMiddleware,
  async (req, res) => {
    res.status(200).json({
      success: true,
      data: req.user
    });
  });


// ✅ GET ALL USERS
router.get('/',authMiddleware, async (req, res) => {
  try {
    const users = await User.find(); // returns an array
    res.status(200).json({
      status: 200,
      success: true,
      data: users.map(user => ({
        id: user.userID,
        name: user.name,
        email: user.email,
        age: user.age,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt   
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: err.message
    });
  }
});


// GET user by email
router.get('/email/:email',authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }); // email ke basis par search
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: err.message
    });
  }
});


// GET USER BY ID
router.get('/:id',authMiddleware, async (req,res)=> {
        try{
            const users = await User.findById(req.params.id);
            res.status(200).json({
                success: true,
                data: users
              });
        }catch(err){
            res.status(500).json({
                success: false,
                message: "Error fetching users",
                error: err.message
              });
        }   
    }
)

// UPDATE BY ID
router.put('/:id',authMiddleware, async (req, res) => {
  const { name, email, age } = req.body;

  if (!name || !email || !age) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and age are required"
    });
  }

  try {
    const user = await User.findByIdAndUpdate(req.params.id, { name, email, age }, { new: true });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: err.message
    });
  }
});

// DELETE BY ID
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: err.message
    });
  }
});


// DELETE ALL USERS with confirmation
router.delete('/',authMiddleware, async (req, res) => {
  const { confirm } = req.body; // expect { "confirm": true } in request

  if (!confirm) {
    return res.status(400).json({
      success: false,
      message: "You must set 'confirm: true' to delete all users"
    });
  }

  try {
    const result = await User.deleteMany(); // deletes all documents
    await counter.findOneAndUpdate(
      { id: 'userID' },
      { seq: 0 },
      { new: true, upsert: true } 
    );

    res.status(200).json({
      success: true,
      message: `All users deleted successfully (${result.deletedCount} users)`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting all users",
      error: err.message
    });
  }
});



module.exports = router;
