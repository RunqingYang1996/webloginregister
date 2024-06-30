const mongoose = require('mongoose');
const User = require('../models/User');

exports.getDatabases = async (req, res) => {
  try {
    const databases = await mongoose.connection.db.admin().listDatabases();
    res.render('databases', { databases: databases.databases, user: req.user });
  } catch (err) {
    console.error('获取数据库列表时出错:', err); // 调试日志
    res.status(500).send('服务器错误');
  }
};

exports.showCreateDbForm = (req, res) => {
  const { username, password } = req.body;
  res.render('createDb', { user: req.user });
};

exports.createDatabase = async (req, res) => {
  const { dbName } = req.body;
  const { username, password } = req.body;
  try {
    console.log(`创建数据库: ${dbName}`); // 调试日志
    const db = mongoose.connection.useDb(dbName);
    await db.collection('dummyCollection').insertOne({ dummy: 'data' });

    // 更新用户的数据库访问权限
    //const user = await User.findById(req.user._id);
    const user = await User.findOne({ username });
    if (!user) {
      console.error(`用户未找到: ${req.user._id}`); // 调试日志
      return res.status(404).send('用户未找到');
    }
    if (!user.databaseAccess.includes(dbName)) {
      user.databaseAccess.push(dbName);
      await user.save();
    }
    console.log(`用户 ${user.username} 拥有访问权限的数据库: ${user.databaseAccess.join(', ')}`);
    console.log(`数据库创建成功: ${dbName}`); // 调试日志
    res.redirect('/databases');
  } catch (err) {
    console.error('创建数据库时出错:', err); // 调试日志
    res.status(500).send('服务器错误');
  }
};

exports.deleteDatabase = async (req, res) => {
  const { dbName } = req.params;
  const { username, password } = req.body;
  try {
    //const user = await User.findById(req.user._id);
    const user = await User.findOne({ username });
    if (!user) {
      console.error(`用户未找到: ${req.user._id}`); // 调试日志
      return res.status(404).send('用户未找到');
    }

    //admin
    if (user.role === 'admin') {
      const databases = await mongoose.connection.db.admin().listDatabases();
      user.databaseAccess = databases.databases.map(db => db.name);
    }

    // 检查用户是否有权限删除该数据库
    if (!user.databaseAccess.includes(dbName)) {
      return res.status(403).send('权限不足');
    }

    const db = mongoose.connection.useDb(dbName);
    await db.dropDatabase();

    user.databaseAccess = user.databaseAccess.filter(db => db !== dbName);
    await user.save();

    res.redirect('/databases');
  } catch (err) {
    console.error('删除数据库时出错:', err); // 调试日志
    res.status(500).send('服务器错误');
  }
};
