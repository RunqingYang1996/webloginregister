const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

exports.ensureAuthenticated = async (req, res, next) => {
  if (process.env.SKIP_AUTH_CHECK === 'true') {
    console.warn('跳过身份验证'); // 调试日志
    const defaultUserId = process.env.DEFAULT_USER_ID;
    const user = await User.findById(defaultUserId);
    if (!user) {
      console.error('默认用户未找到'); // 调试日志
      return res.status(500).send('默认用户未找到');
    }
    req.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      databaseAccess: user.databaseAccess,
    };

    // 如果用户是admin，获取所有数据库并赋予访问权限
    if (req.user.role === 'admin') {
      const databases = await mongoose.connection.db.admin().listDatabases();
      req.user.databaseAccess = databases.databases.map(db => db.name);
    }

    return next();
  }

  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).send('访问被拒绝');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).send('用户未找到');
    }
    req.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      databaseAccess: user.databaseAccess,
    };

    // 如果用户是admin，获取所有数据库并赋予访问权限
    if (req.user.role === 'admin') {
      const databases = await mongoose.connection.db.admin().listDatabases();
      req.user.databaseAccess = databases.databases.map(db => db.name);
    }

    next();
  } catch (err) {
    res.status(400).send('无效的令牌');
  }
};

exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('权限不足');
    }
    next();
  };
};
