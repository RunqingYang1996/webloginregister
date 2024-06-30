const express = require('express');
const router = express.Router();
const dbController = require('../controllers/dbController');
const { ensureAuthenticated } = require('../middleware/auth');

// 获取数据库列表
router.get('/', ensureAuthenticated, dbController.getDatabases);

// 显示创建数据库的表单
router.get('/create-db', ensureAuthenticated, dbController.showCreateDbForm);

// 创建新数据库
router.post('/create', ensureAuthenticated, dbController.createDatabase);

// 删除数据库
router.post('/delete/:dbName', ensureAuthenticated, dbController.deleteDatabase);

module.exports = router;
