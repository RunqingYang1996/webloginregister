const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log('注册用户:', username); // 调试日志
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('用户名已存在');
    }

    let user = new User({ username, password, role: 'user', databaseAccess: [] });
    user.password = await bcrypt.hash(password, 10); // 对密码进行哈希处理
    await user.save();
    const token = jwt.sign({ _id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET);
    res.header('Authorization', token).redirect(`/databases/create-db?token=${token}`);
  } catch (err) {
    console.error('注册错误:', err); // 调试日志
    res.status(500).send('服务器错误');
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log('登录用户:', username); // 调试日志
    const user = await User.findOne({ username });
    if (!user) {
      console.error('用户名未找到'); // 调试日志
      return res.status(400).send('用户名或密码错误');
    }

    // 在开发环境中跳过密码验证
    if (process.env.SKIP_PASSWORD_CHECK === 'true') {
      console.warn('跳过密码验证'); // 调试日志
    } else {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.error('密码错误'); // 调试日志
        return res.status(400).send('用户名或密码错误');
      }
    }

    const token = jwt.sign({ _id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET);

    if (user.role === 'admin') {
      res.header('Authorization', token).redirect(`/databases?token=${token}`);
    } else {
      res.header('Authorization', token).redirect(`/hello-world?token=${token}`);
    }
  } catch (err) {
    console.error('登录错误:', err); // 调试日志
    res.status(500).send('服务器错误');
  }
};

exports.showLoginForm = (req, res) => {
  res.render('login');
};

exports.showRegisterForm = (req, res) => {
  res.render('register');
};
