const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 显示注册表单
router.get('/register', authController.showRegisterForm);

// 显示登录表单
router.get('/login', authController.showLoginForm);

router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
