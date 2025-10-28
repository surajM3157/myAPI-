const jwt  = require ('jsonwebtoken');
const User = require('../models/userModel');


   
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if(!token){
        return res.status(401).json({ success: false, message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('Decoded token:', decoded);
        // Attach full user
        const user = await User.findOne({ userID: decoded.id });
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        //  console.error('Token verification failed:', err.message);
        return res.status(401).json({ success: false, message: 'Token is not valid' });
    }
}

    module.exports = authMiddleware;