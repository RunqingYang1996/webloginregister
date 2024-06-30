const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // 用户名
  password: { type: String, required: true }, // 密码
  role: { type: String, enum: ['admin', 'user'], default: 'user' }, // 角色
  databaseAccess: [{ type: String }] // 用户可访问的数据库列表
});

// 密码哈希中间件
UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
