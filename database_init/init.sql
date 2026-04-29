-- ============================================
-- 1. 创建数据库
-- ============================================
CREATE DATABASE IF NOT EXISTS canteen_user   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS canteen_menu   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS canteen_order  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS canteen_pickup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 2. 用户服务库：canteen_user
-- ============================================
USE canteen_user;

CREATE TABLE sys_user (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    student_no      VARCHAR(32) UNIQUE COMMENT '学工号',
    phone           VARCHAR(20) UNIQUE COMMENT '手机号',
    password        VARCHAR(128) NOT NULL COMMENT 'BCrypt加密密码',
    nickname        VARCHAR(64) COMMENT '昵称',
    avatar          VARCHAR(255) COMMENT '头像URL',
    role            TINYINT DEFAULT 0 COMMENT '角色：0-普通用户，1-商家，2-管理员',
    status          TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除：0-正常，1-删除',
    INDEX idx_phone (phone),
    INDEX idx_student_no (student_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 3. 菜品与菜单服务库：canteen_menu
-- ============================================
USE canteen_menu;

-- 菜品基础表（长期信息）
CREATE TABLE dish (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '菜品ID',
    merchant_id     BIGINT UNSIGNED NOT NULL COMMENT '所属商家用户ID',
    name            VARCHAR(128) NOT NULL COMMENT '菜品名称',
    description     TEXT COMMENT '菜品描述',
    price           DECIMAL(10,2) NOT NULL COMMENT '基础售价',
    image           VARCHAR(255) COMMENT '图片URL',
    category        VARCHAR(64) COMMENT '分类：主食/小吃/饮料等',
    status          TINYINT DEFAULT 1 COMMENT '上下架：0-下架，1-上架',
    stock_threshold INT UNSIGNED DEFAULT 10 COMMENT '库存预警阈值',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_merchant (merchant_id),
    INDEX idx_category (category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜品表';

-- 每日菜单表
CREATE TABLE menu (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '菜单ID',
    name            VARCHAR(128) NOT NULL COMMENT '菜单名称，如：今日午餐',
    sale_date       DATE NOT NULL COMMENT '售卖日期',
    start_time      TIME NOT NULL COMMENT '售卖开始时间',
    end_time        TIME NOT NULL COMMENT '售卖结束时间',
    status          TINYINT DEFAULT 1 COMMENT '状态：0-失效，1-生效',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_sale_date (sale_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日菜单表';

-- 菜单菜品关联表（含当日库存、当日售价）
CREATE TABLE menu_dish (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
    menu_id         BIGINT UNSIGNED NOT NULL COMMENT '菜单ID',
    dish_id         BIGINT UNSIGNED NOT NULL COMMENT '菜品ID',
    sale_price      DECIMAL(10,2) NOT NULL COMMENT '当日售价',
    stock           INT UNSIGNED DEFAULT 0 COMMENT '当日库存余量',
    sold            INT UNSIGNED DEFAULT 0 COMMENT '当日已售数量',
    status          TINYINT DEFAULT 1 COMMENT '状态：0-停售，1-可售',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_menu_dish (menu_id, dish_id),
    INDEX idx_dish (dish_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单菜品关联与库存表';

-- ============================================
-- 4. 订单服务库：canteen_order
-- ============================================
USE canteen_order;

-- 订单主表
CREATE TABLE orders (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_no        VARCHAR(32) UNIQUE NOT NULL COMMENT '订单编号，如：O202604270001',
    user_id         BIGINT UNSIGNED NOT NULL COMMENT '下单用户ID',
    window_id       BIGINT UNSIGNED NOT NULL COMMENT '取餐窗口ID',
    total_amount    DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
    status          TINYINT DEFAULT 0 COMMENT '状态：0-已下单，1-已接单，2-制作中，3-待取餐，4-已取餐，5-已取消',
    pickup_no       VARCHAR(16) COMMENT '取餐号（叫号用，如：A001）',
    pickup_code     VARCHAR(16) UNIQUE COMMENT '取餐码（核销用，6位随机数字）',
    remark          VARCHAR(255) COMMENT '用户备注',
    cancel_type     TINYINT COMMENT '取消类型：1-用户取消，2-支付超时，3-商家超时未接单',
    cancel_time     DATETIME COMMENT '取消时间',
    pay_deadline    DATETIME COMMENT '支付截止时间（用于超时自动取消）',
    accept_deadline DATETIME COMMENT '商家接单截止时间',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_user (user_id),
    INDEX idx_window (window_id),
    INDEX idx_status (status),
    INDEX idx_order_no (order_no),
    INDEX idx_pickup_code (pickup_code),
    INDEX idx_pay_deadline (pay_deadline),
    INDEX idx_accept_deadline (accept_deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

-- 订单明细表
CREATE TABLE order_item (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID',
    order_id        BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
    dish_id         BIGINT UNSIGNED NOT NULL COMMENT '菜品ID',
    menu_dish_id    BIGINT UNSIGNED COMMENT '当日菜单菜品ID（用于库存追溯）',
    dish_name       VARCHAR(128) NOT NULL COMMENT '菜品名称（冗余）',
    quantity        INT UNSIGNED NOT NULL COMMENT '数量',
    unit_price      DECIMAL(10,2) NOT NULL COMMENT '下单时单价',
    subtotal        DECIMAL(10,2) NOT NULL COMMENT '小计金额',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_order (order_id),
    INDEX idx_dish (dish_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- ============================================
-- 5. 取餐与排队服务库：canteen_pickup
-- ============================================
USE canteen_pickup;

-- 窗口表
CREATE TABLE canteen_window (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '窗口ID',
    name            VARCHAR(128) NOT NULL COMMENT '窗口名称，如：1号档口-盖浇饭',
    location        VARCHAR(255) COMMENT '物理位置描述',
    merchant_id     BIGINT UNSIGNED COMMENT '负责商家用户ID',
    status          TINYINT DEFAULT 1 COMMENT '状态：0-关闭，1-营业',
    pickup_prefix   VARCHAR(8) DEFAULT 'A' COMMENT '取餐号前缀，与单库 init_canteen_single.sql 一致',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_merchant (merchant_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='食堂窗口表';

-- 取餐记录表（Redis 队列的持久化备份，用于历史查询）
CREATE TABLE pickup_record (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    order_id        BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
    window_id       BIGINT UNSIGNED NOT NULL COMMENT '窗口ID',
    pickup_no       VARCHAR(16) COMMENT '取餐号',
    queue_status    TINYINT DEFAULT 0 COMMENT '排队状态：0-排队中，1-已叫号，2-已取餐，3-已过号',
    queue_time      DATETIME COMMENT '进入队列时间',
    call_time       DATETIME COMMENT '叫号时间',
    pickup_time     DATETIME COMMENT '实际取餐时间',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_order (order_id),
    INDEX idx_window (window_id),
    INDEX idx_queue_status (queue_status),
    INDEX idx_pickup_no (pickup_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='取餐排队记录表';

-- ============================================
-- 6. 兼容性补丁（可重复执行）
--    说明：用于“脚本已跑过/表已存在但字段缺失”的场景，
--    例如旧版本缺少 canteen_window.pickup_prefix，导致插入失败。
-- ============================================

-- 6.1 canteen_pickup.canteen_window：补齐 pickup_prefix 列（如缺失）
SET @col_exists := (
    SELECT COUNT(1)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'canteen_pickup'
      AND TABLE_NAME = 'canteen_window'
      AND COLUMN_NAME = 'pickup_prefix'
);
SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE canteen_pickup.canteen_window ADD COLUMN pickup_prefix VARCHAR(8) DEFAULT ''A'' COMMENT ''取餐号前缀'' AFTER status',
    'SELECT ''OK: canteen_window.pickup_prefix exists'' AS _'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6.2 canteen_menu.menu_dish：补齐唯一约束 uk_menu_dish(menu_id, dish_id)（如缺失）
SET @uk_exists := (
    SELECT COUNT(1)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = 'canteen_menu'
      AND TABLE_NAME = 'menu_dish'
      AND CONSTRAINT_NAME = 'uk_menu_dish'
      AND CONSTRAINT_TYPE = 'UNIQUE'
);
SET @ddl := IF(
    @uk_exists = 0,
    'ALTER TABLE canteen_menu.menu_dish ADD CONSTRAINT uk_menu_dish UNIQUE (menu_id, dish_id)',
    'SELECT ''OK: menu_dish.uk_menu_dish exists'' AS _'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;