const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const userRoutes = require('./routes/userRoutes');
const dbRoutes = require('./routes/dbRoutes');
const authRoutes = require('./routes/authRoutes');
const helloWorldRoutes = require('./routes/helloWorldRoutes');
const User = require('./models/User');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 连接到 MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB 连接成功...'))
  .catch(err => console.log(err));

// 中间件设置
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 设置 Pug 作为模板引擎
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 初始化默认用户
const initializeDefaultUser = async () => {
  try {
    let user = await User.findOne({ username: 'defaultUser1' });
    if (!user) {
      const hashedPassword = await bcrypt.hash('defaultPassword1', 10);
      user = new User({
        username: 'defaultUser1',
        password: hashedPassword,
        role: 'admin',
        databaseAccess: ['pictures', 'user_management']
      });
      await user.save();
      console.log('默认用户创建成功: 用户名: defaultUseradmin, 密码: defaultPassword');
    } else {
      console.log('默认用户已存在');
    }
    process.env.DEFAULT_USER_ID = user._id.toString();
  } catch (err) {
    console.error('创建默认用户时出错:', err);
  }
};

const initializeDefaultUser2 = async () => {
    try {
      let user = await User.findOne({ username: 'defaultUser123' });
      if (!user) {
        const hashedPassword = await bcrypt.hash('defaultPassword1', 10);
        user = new User({
          username: 'defaultUser123',
          password: hashedPassword,
          role: 'user',
          databaseAccess: ['pictures', 'user_management']
        });
        await user.save();
        console.log('默认用户创建成功: 用户名: defaultUseruser, 密码: defaultPassword');
      } else {
        console.log('默认用户已存在');
      }
      process.env.DEFAULT_USER_ID = user._id.toString();
    } catch (err) {
      console.error('创建默认用户时出错:', err);
    }
  };

// 调用初始化函数
initializeDefaultUser();
initializeDefaultUser2();
// 路由设置
app.use('/users', userRoutes);
app.use('/databases', dbRoutes);
app.use('/auth', authRoutes);
app.use('/', helloWorldRoutes);

app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
