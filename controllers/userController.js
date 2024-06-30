const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.render('users', { users });
  } catch (err) {
    res.status(500).send('服务器错误get');
  }
};

exports.addUser = async (req, res) => {
  const { username, password, role } = req.body;
  try {
    let user = new User({ username, password, role });
    await user.save();
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('服务器错误adduser');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('服务器错误delete');
  }
};

exports.updateUser = async (req, res) => {
  const { username, role } = req.body;
  try {
    await User.findByIdAndUpdate(req.params.id, { username, role });
    res.redirect('/users');
  } catch (err) {
    res.status(500).send('服务器错误update');
  }
};

exports.getUserForm = (req, res) => {
  res.render('addUser');
};
