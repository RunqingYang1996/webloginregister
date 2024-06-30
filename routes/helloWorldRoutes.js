const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

// 显示 Hello World 页面
router.get('/hello-world', ensureAuthenticated, (req, res) => {
  res.render('helloWorld', { user: req.user });
});

// 根路由重定向到登录页面或 Hello World 页面
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

module.exports = router;
