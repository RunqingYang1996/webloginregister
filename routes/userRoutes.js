const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { ensureAuthenticated, checkRole } = require('../middleware/auth');

// 获取用户列表
router.get('/', ensureAuthenticated, checkRole(['admin']), userController.getUsers);

// 添加新用户
router.post('/add', ensureAuthenticated, checkRole(['admin']), userController.addUser);

// 删除用户
router.post('/delete/:id', ensureAuthenticated, checkRole(['admin']), userController.deleteUser);

// 更新用户
router.post('/update/:id', ensureAuthenticated, checkRole(['admin']), userController.updateUser);

// 获取添加用户的表单页面
router.get('/add', ensureAuthenticated, checkRole(['admin']), userController.getUserForm);

module.exports = router;
