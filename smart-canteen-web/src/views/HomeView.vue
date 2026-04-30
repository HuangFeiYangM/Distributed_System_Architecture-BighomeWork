<template>
  <div class="wrap">
    <el-card class="hero-card">
      <div class="hero-head">
        <div>
          <h1>{{ roleLabel }}控制台</h1>
          <p>智能食堂点餐与取餐微服务系统</p>
        </div>
        <el-space wrap>
          <el-button :loading="loading" @click="loadAll">刷新数据</el-button>
          <el-button type="primary" plain @click="goDisplay">取餐大屏</el-button>
          <el-button type="primary" plain @click="goProfile">个人中心</el-button>
          <el-button type="danger" plain @click="logout">退出登录</el-button>
        </el-space>
      </div>
      <div class="kpi-grid">
        <div class="kpi-item">
          <span class="kpi-label">可用窗口</span>
          <strong class="kpi-value">{{ windows.length }}</strong>
        </div>
        <div v-if="isUser" class="kpi-item">
          <span class="kpi-label">待取餐订单</span>
          <strong class="kpi-value">{{ userReadyCount }}</strong>
        </div>
        <div v-if="isUser" class="kpi-item">
          <span class="kpi-label">今日菜单菜品</span>
          <strong class="kpi-value">{{ flatDishes.length }}</strong>
        </div>
        <div v-if="isMerchant" class="kpi-item">
          <span class="kpi-label">待处理订单</span>
          <strong class="kpi-value">{{ merchantPendingCount }}</strong>
        </div>
        <div v-if="isMerchant" class="kpi-item">
          <span class="kpi-label">低库存菜品</span>
          <strong class="kpi-value">{{ lowStockDishes.length }}</strong>
        </div>
        <div v-if="isAdmin" class="kpi-item">
          <span class="kpi-label">启用窗口</span>
          <strong class="kpi-value">{{ activeWindowCount }}</strong>
        </div>
        <div v-if="isAdmin" class="kpi-item">
          <span class="kpi-label">商家用户数</span>
          <strong class="kpi-value">{{ merchantUsers.length }}</strong>
        </div>
      </div>
    </el-card>

    <el-card class="nav-card">
      <div class="role-nav">
        <el-button
          v-for="item in roleNavItems"
          :key="item.key"
          :type="activeSection === item.key ? 'primary' : 'default'"
          plain
          class="nav-item-btn"
          @click="activeSection = item.key"
        >
          {{ item.label }}
        </el-button>
      </div>
    </el-card>

    <el-row v-if="isUser && activeSection === sectionIdMap.userMenu" :gutter="16">
      <el-col :span="16">
        <el-card :id="sectionIdMap.userMenu" class="student-menu-card">
          <template #header>
            <div class="section-head">
              <span>今日菜单与下单</span>
              <small>库存来自菜单服务的当日菜单库存</small>
            </div>
          </template>
          <el-input v-model="userMenuKeyword" placeholder="按菜品名/菜单菜品ID查询" class="query-input" />
          <el-empty v-if="filteredMenuDishes.length === 0" description="当前无可用菜单" />
          <el-table v-else :data="filteredMenuDishes" size="small">
            <el-table-column prop="dishName" label="菜品" min-width="120" />
            <el-table-column prop="salePrice" label="价格" width="90">
              <template #default="{ row }">¥{{ row.salePrice }}</template>
            </el-table-column>
            <el-table-column prop="stock" label="库存" width="80" />
            <el-table-column label="提示" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.stock <= 10" type="danger" size="small">库存紧张</el-tag>
                <el-tag v-else type="success" size="small">充足</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="120">
              <template #default="{ row }">
                <el-input-number v-model="quantityMap[row.id]" :min="0" :max="20" :step="1" size="small" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="section-head">
              <span>订单确认</span>
              <small>选择窗口并提交</small>
            </div>
          </template>
          <el-form label-width="90px">
            <el-form-item label="取餐窗口">
              <el-select v-model="selectedWindowId" placeholder="请选择窗口" style="width: 100%">
                <el-option v-for="w in windows" :key="w.id" :label="`${w.name} (${w.location})`" :value="w.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="remark" placeholder="例如：少辣、不加葱" />
            </el-form-item>
          </el-form>
          <el-alert :closable="false" type="info" :title="`下单窗口：${selectedWindowLabel}`" />

          <div class="summary">
            <p>已选菜品：{{ selectedCount }} 份</p>
            <p>预估金额：¥{{ totalAmount.toFixed(2) }}</p>
          </div>

          <el-button type="primary" class="full-btn" :loading="submitting" @click="submitOrder">提交订单</el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="isUser && activeSection === sectionIdMap.userOrders" :id="sectionIdMap.userOrders" class="order-card">
      <template #header>
        <div class="section-head">
          <span>我的订单</span>
          <el-radio-group v-model="userOrderFilter" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button :label="0">已下单</el-radio-button>
            <el-radio-button :label="3">待取餐</el-radio-button>
            <el-radio-button :label="4">已取餐</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-input v-model="userOrderKeyword" placeholder="按订单号/取餐码/叫号码查询" class="query-input" />
      <el-table :data="filteredUserOrders" size="small">
        <el-table-column prop="id" label="订单ID" width="90" />
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column prop="totalAmount" label="金额" width="90">
          <template #default="{ row }">¥{{ row.totalAmount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="pickupCode" label="取餐码" width="110" />
        <el-table-column prop="pickupNo" label="叫号码" width="90" />
        <el-table-column prop="createTime" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-space>
              <el-button link type="primary" @click="showOrderDetail(row.id)">详情</el-button>
              <el-button v-if="row.status === 0" link type="danger" @click="cancelOrder(row.id)">取消</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <template v-else-if="isMerchant">
      <el-row :gutter="16">
        <el-col v-if="activeSection === sectionIdMap.merchantFulfill" :span="24" class="block">
          <el-card :id="sectionIdMap.merchantFulfill">
            <template #header>
              <div class="section-head">
                <span>订单履约中心</span>
                <small>处理接单、制作和出餐流程</small>
              </div>
            </template>
            <el-input v-model="merchantOrderKeyword" placeholder="按订单号/取餐码/订单ID查询" class="query-input" />
            <el-table :data="filteredMerchantOrders" size="small">
              <el-table-column prop="id" label="订单ID" width="90" />
              <el-table-column prop="orderNo" label="订单号" min-width="160" />
              <el-table-column prop="windowId" label="窗口ID" width="90" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">{{ statusText(row.status) }}</template>
              </el-table-column>
              <el-table-column prop="pickupCode" label="取餐码" width="110" />
              <el-table-column label="操作" min-width="240">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" :disabled="row.status !== 0" @click="changeStatus(row.id, 'accept')">接单</el-button>
                    <el-button size="small" :disabled="row.status !== 1" @click="changeStatus(row.id, 'cook')">制作</el-button>
                    <el-button size="small" type="success" :disabled="row.status !== 2" @click="changeStatus(row.id, 'ready')">
                      完成
                    </el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.merchantPickup" :span="24" class="block">
          <el-card :id="sectionIdMap.merchantPickup">
            <template #header>
              <div class="section-head">
                <span>叫号与核销</span>
                <small>窗口出餐操作</small>
              </div>
            </template>
            <el-form label-width="80px">
              <el-form-item label="窗口">
                <el-select v-model="selectedWindowId" placeholder="请选择窗口" style="width: 100%">
                  <el-option v-for="w in windows" :key="w.id" :label="`${w.name} (${w.location})`" :value="w.id" />
                </el-select>
              </el-form-item>
            </el-form>
            <el-space wrap>
              <el-button type="primary" @click="callNext">叫下一个号</el-button>
              <el-button @click="loadQueue">刷新队列</el-button>
            </el-space>

            <el-divider />
            <div>当前队列（{{ queueList.length }}）</div>
            <el-tag v-for="item in queueList" :key="item" class="queue-tag">{{ item }}</el-tag>

            <el-divider />
            <el-input v-model="verifyCode" placeholder="输入取餐码，例如 408765" />
            <el-button class="verify-btn" type="success" @click="verifyPickup">核销取餐</el-button>

            <el-divider />
            <div class="section-sub-title">按取餐码查询订单</div>
            <el-input v-model="searchPickupCode" placeholder="输入取餐码进行查询" />
            <el-button class="verify-btn" type="primary" plain @click="searchOrderByCode">查询订单</el-button>
            <el-descriptions v-if="searchedOrder" :column="1" border class="search-result">
              <el-descriptions-item label="订单ID">{{ searchedOrder.id }}</el-descriptions-item>
              <el-descriptions-item label="用户ID">{{ searchedOrder.userId }}</el-descriptions-item>
              <el-descriptions-item label="窗口ID">{{ searchedOrder.windowId }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ statusText(searchedOrder.status) }}</el-descriptions-item>
              <el-descriptions-item label="取餐码">{{ searchedOrder.pickupCode }}</el-descriptions-item>
              <el-descriptions-item label="叫号码">{{ searchedOrder.pickupNo || "-" }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.merchantStock" :span="24" class="block">
          <el-card :id="sectionIdMap.merchantStock">
            <template #header>
              <div class="section-head">
                <span>库存预警</span>
                <small>阈值可调</small>
              </div>
            </template>
            <el-space wrap class="query-row">
              <el-form-item label="低库存阈值" class="inline-form-item">
                <el-input-number v-model="lowStockThreshold" :min="1" :max="200" :step="1" />
              </el-form-item>
              <el-input v-model="lowStockKeyword" placeholder="按菜品名/菜单菜品ID查询" class="query-input-short" />
            </el-space>
            <el-empty v-if="filteredLowStockDishes.length === 0" :description="`当前无低库存菜品（阈值<=${lowStockThreshold}）`" />
            <el-table v-else :data="filteredLowStockDishes" size="small">
              <el-table-column prop="id" label="菜单菜品ID" width="100" />
              <el-table-column prop="dishName" label="菜品" min-width="120" />
              <el-table-column prop="salePrice" label="售价" width="90" />
              <el-table-column prop="stock" label="剩余库存" width="90" />
              <el-table-column prop="sold" label="已售" width="80" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">{{ row.status === 1 ? "上架" : "下架" }}</template>
              </el-table-column>
              <el-table-column label="预警" width="100">
                <template #default>
                  <el-tag type="danger" size="small">库存紧张</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button link type="primary" :loading="menuDishDetailLoading" @click="showMenuDishDetail(row.id)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.merchantDish" :span="24" class="block">
          <el-card :id="sectionIdMap.merchantDish">
            <template #header>
              <div class="section-head">
                <span>菜品管理</span>
                <small>新增、上下架与编辑</small>
              </div>
            </template>
            <el-alert type="warning" :closable="false" title="已发布菜单中的菜品不允许直接编辑/上下架/删除。" class="tip-alert" />
            <el-input v-model="dishKeyword" placeholder="按菜品名/ID/分类查询" class="query-input" />
            <el-form inline>
              <el-form-item label="名称">
                <el-input v-model="dishForm.name" placeholder="例如：宫保鸡丁" />
              </el-form-item>
              <el-form-item label="价格">
                <el-input-number v-model="dishForm.price" :min="0.01" :step="0.5" />
              </el-form-item>
              <el-form-item label="分类">
                <el-input v-model="dishForm.category" placeholder="主食/小吃/饮料" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="creatingDish" @click="saveDish">
                  {{ dishForm.id ? "更新菜品" : "新增菜品" }}
                </el-button>
                <el-button v-if="dishForm.id" @click="resetDishForm">取消编辑</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="filteredMerchantDishes" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="name" label="菜品" min-width="120" />
              <el-table-column prop="price" label="价格" width="90" />
              <el-table-column prop="category" label="分类" width="90" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">{{ row.status === 1 ? "上架" : "下架" }}</template>
              </el-table-column>
              <el-table-column label="操作" min-width="260">
                <template #default="{ row }">
                  <el-space wrap>
                    <el-button size="small" :disabled="publishedDishIdSet.has(row.id)" @click="editDish(row)">编辑</el-button>
                    <el-button
                      size="small"
                      :disabled="publishedDishIdSet.has(row.id)"
                      :type="row.status === 1 ? 'warning' : 'success'"
                      @click="toggleDishStatus(row)"
                    >
                      {{ row.status === 1 ? "下架" : "上架" }}
                    </el-button>
                    <el-button size="small" type="danger" :disabled="publishedDishIdSet.has(row.id)" @click="removeDish(row.id)">删除</el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.merchantMenu" :span="24" class="block">
          <el-card :id="sectionIdMap.merchantMenu">
            <template #header>
              <div class="section-head">
                <span>菜单发布</span>
                <small>配置时间与入选菜品</small>
              </div>
            </template>
            <el-form inline>
              <el-form-item label="菜单名称">
                <el-input v-model="menuForm.name" />
              </el-form-item>
              <el-form-item label="日期">
                <el-date-picker v-model="menuForm.saleDate" type="date" value-format="YYYY-MM-DD" />
              </el-form-item>
              <el-form-item label="开始">
                <el-time-picker v-model="menuForm.startTime" value-format="HH:mm:ss" />
              </el-form-item>
              <el-form-item label="结束">
                <el-time-picker v-model="menuForm.endTime" value-format="HH:mm:ss" />
              </el-form-item>
            </el-form>

            <el-table :data="merchantDishes" size="small">
              <el-table-column prop="name" label="菜品" min-width="120" />
              <el-table-column label="售价" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="menuItemMap[row.id].salePrice" :min="0.01" :step="0.5" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="menuItemMap[row.id].stock" :min="0" :step="10" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="入选" width="100">
                <template #default="{ row }">
                  <el-switch v-model="menuItemMap[row.id].enabled" />
                </template>
              </el-table-column>
            </el-table>
            <el-button class="publish-btn" type="primary" :loading="publishingMenu" @click="publishMenu">发布菜单</el-button>
          </el-card>
        </el-col>
      </el-row>
    </template>

    <template v-else>
      <el-row :gutter="16">
        <el-col v-if="activeSection === sectionIdMap.adminCreateWindow" :span="24">
          <el-card :id="sectionIdMap.adminCreateWindow">
            <template #header>
              <div class="section-head">
                <span>窗口创建</span>
                <small>分配商家并初始化叫号前缀</small>
              </div>
            </template>
            <el-form label-width="95px">
              <el-form-item label="窗口名称">
                <el-input v-model="windowForm.name" placeholder="例如：1号档口-盖浇饭" />
              </el-form-item>
              <el-form-item label="位置">
                <el-input v-model="windowForm.location" placeholder="例如：食堂一楼东侧" />
              </el-form-item>
              <el-form-item label="商家账号">
                <el-select v-model="windowForm.merchantId" placeholder="请选择商家" style="width: 100%">
                  <el-option
                    v-for="m in merchantUsers"
                    :key="m.id"
                    :label="`${m.nickname} (${m.phone})`"
                    :value="m.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="叫号前缀">
                <el-input v-model="windowForm.pickupPrefix" maxlength="2" placeholder="例如：A" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="creatingWindow" @click="createWindow">创建窗口</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
        <el-col v-if="activeSection === sectionIdMap.adminWindows" :span="24">
          <el-card :id="sectionIdMap.adminWindows">
            <template #header>
              <div class="section-head">
                <span>窗口列表</span>
                <small>窗口状态总览</small>
              </div>
            </template>
            <el-input v-model="windowKeyword" placeholder="按窗口名/位置/商家ID查询" class="query-input" />
            <el-table :data="filteredWindows" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="name" label="窗口名称" min-width="120" />
              <el-table-column prop="location" label="位置" min-width="140" />
              <el-table-column prop="merchantId" label="商家ID" width="90" />
              <el-table-column prop="pickupPrefix" label="前缀" width="80" />
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">{{ row.status === 1 ? "启用" : "停用" }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col v-if="activeSection === sectionIdMap.adminUsers" :span="24">
          <el-card :id="sectionIdMap.adminUsers">
            <template #header>
              <div class="section-head">
                <span>用户列表</span>
                <small>账号与角色分布</small>
              </div>
            </template>
            <el-input v-model="userKeyword" placeholder="按用户ID/手机号/昵称查询" class="query-input" />
            <el-table :data="filteredUsers" size="small">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="phone" label="手机号" width="130" />
              <el-table-column prop="nickname" label="昵称" min-width="100" />
              <el-table-column prop="role" label="角色" width="90">
                <template #default="{ row }">{{ roleNameByValue(row.role) }}</template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">{{ row.status === 1 ? "启用" : "停用" }}</template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrap">
              <el-pagination
                background
                layout="total, sizes, prev, pager, next"
                :total="adminUserTotal"
                :current-page="adminUserPage"
                :page-size="adminUserSize"
                :page-sizes="[5, 10, 20, 50]"
                @current-change="onAdminUserPageChange"
                @size-change="onAdminUserSizeChange"
              />
            </div>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.adminMenuDetail" :span="24">
          <el-card :id="sectionIdMap.adminMenuDetail">
            <template #header>
              <div class="section-head">
                <span>菜单详情查询</span>
                <small>按菜单ID/菜单名称查询</small>
              </div>
            </template>
            <el-input v-model="menuKeyword" placeholder="按菜单ID/菜单名称查询" class="query-input" />
            <el-empty v-if="filteredAdminMenus.length === 0" description="当前无可查询菜单" />
            <el-table v-else :data="filteredAdminMenus" size="small">
              <el-table-column prop="id" label="菜单ID" width="100" />
              <el-table-column prop="name" label="菜单名称" min-width="150" />
              <el-table-column prop="saleDate" label="日期" width="120" />
              <el-table-column prop="startTime" label="开始" width="110" />
              <el-table-column prop="endTime" label="结束" width="110" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button link type="primary" :loading="adminMenuLoading" @click="openAdminMenuDetail(row.id)">查看详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col v-if="activeSection === sectionIdMap.adminDishDetail" :span="24">
          <el-card :id="sectionIdMap.adminDishDetail">
            <template #header>
              <div class="section-head">
                <span>菜品详情查询</span>
                <small>按菜品ID查询</small>
              </div>
            </template>
            <el-space wrap>
              <el-input-number v-model="adminDishQueryId" :min="1" :step="1" placeholder="输入菜品ID" />
              <el-button type="primary" :loading="adminDishQueryLoading" @click="queryAdminDishDetail">查询菜品</el-button>
            </el-space>
            <el-descriptions v-if="adminDishDetail" :column="2" border class="search-result">
              <el-descriptions-item label="菜品ID">{{ adminDishDetail.id }}</el-descriptions-item>
              <el-descriptions-item label="商家ID">{{ adminDishDetail.merchantId }}</el-descriptions-item>
              <el-descriptions-item label="名称">{{ adminDishDetail.name }}</el-descriptions-item>
              <el-descriptions-item label="分类">{{ adminDishDetail.category || "-" }}</el-descriptions-item>
              <el-descriptions-item label="价格">¥{{ adminDishDetail.price }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ adminDishDetail.status === 1 ? "上架" : "下架" }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>
    </template>

    <el-dialog v-model="detailVisible" title="订单详情" width="720px">
      <el-descriptions v-if="detailOrder" :column="2" border>
        <el-descriptions-item label="订单ID">{{ detailOrder.id }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detailOrder.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="窗口ID">{{ detailOrder.windowId }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(detailOrder.status) }}</el-descriptions-item>
        <el-descriptions-item label="取餐码">{{ detailOrder.pickupCode }}</el-descriptions-item>
        <el-descriptions-item label="叫号码">{{ detailOrder.pickupNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ detailOrder.totalAmount }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detailOrder.remark || "-" }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-table :data="detailOrder?.items || []" size="small">
        <el-table-column prop="dishName" label="菜品" min-width="130" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="unitPrice" label="单价" width="90" />
        <el-table-column prop="subtotal" label="小计" width="100" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="menuDishDetailVisible" title="库存详情" width="520px">
      <el-descriptions v-if="menuDishDetail" :column="1" border>
        <el-descriptions-item label="菜单菜品ID">{{ menuDishDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="菜品">{{ menuDishDetail.dishName }}</el-descriptions-item>
        <el-descriptions-item label="售价">¥{{ menuDishDetail.salePrice }}</el-descriptions-item>
        <el-descriptions-item label="库存">{{ menuDishDetail.stock }}</el-descriptions-item>
        <el-descriptions-item label="已售">{{ menuDishDetail.sold }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ menuDishDetail.status === 1 ? "上架" : "下架" }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无详情数据" />
    </el-dialog>

    <el-dialog v-model="adminMenuDetailVisible" title="菜单详情" width="760px">
      <el-descriptions v-if="adminMenuDetail" :column="2" border>
        <el-descriptions-item label="菜单ID">{{ adminMenuDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="菜单名称">{{ adminMenuDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="日期">{{ adminMenuDetail.saleDate }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ adminMenuDetail.status === 1 ? "启用" : "停用" }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-table :data="adminMenuDetail?.dishes || []" size="small">
        <el-table-column prop="id" label="菜单菜品ID" width="110" />
        <el-table-column prop="dishId" label="菜品ID" width="90" />
        <el-table-column prop="dishName" label="菜品" min-width="130" />
        <el-table-column prop="salePrice" label="售价" width="90" />
        <el-table-column prop="stock" label="库存" width="90" />
        <el-table-column prop="sold" label="已售" width="90" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import {
  getMenuDetailApi,
  getMenuDishDetailApi,
  getTodayMenusApi,
  publishMenuApi,
  type MenuDish,
  type MenuDishDetail,
  type TodayMenu
} from "../api/menu";
import {
  cancelOrderApi,
  getMyOrdersApi,
  createOrderApi,
  updateOrderStatusApi,
  getOrderDetailApi,
  getOrderByPickupCodeApi,
  type OrderBrief,
  type OrderRecord
} from "../api/order";
import {
  getWindowsApi,
  getWindowQueueApi,
  callNextApi,
  verifyPickupApi,
  createWindowApi,
  type PickupWindow
} from "../api/pickup";
import { getUserListApi, type UserRecord } from "../api/user";
import {
  createDishApi,
  deleteDishApi,
  getDishDetailApi,
  getDishListApi,
  updateDishApi,
  updateDishStatusApi,
  type Dish
} from "../api/dish";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const windows = ref<PickupWindow[]>([]);
const orders = ref<OrderRecord[]>([]);
const merchantOrders = ref<OrderRecord[]>([]);
const dishes = ref<MenuDish[]>([]);
const merchantTodayMenus = ref<TodayMenu[]>([]);
const adminMenus = ref<TodayMenu[]>([]);
const lowStockDishes = ref<MenuDish[]>([]);
const merchantUsers = ref<UserRecord[]>([]);
const allUsers = ref<UserRecord[]>([]);
const merchantDishes = ref<Dish[]>([]);
const selectedWindowId = ref<number | null>(null);
const remark = ref("");
const quantityMap = reactive<Record<number, number>>({});
const queueList = ref<string[]>([]);
const verifyCode = ref("");
const searchPickupCode = ref("");
const searchedOrder = ref<OrderBrief | null>(null);
const detailVisible = ref(false);
const detailOrder = ref<OrderRecord | null>(null);
const menuDishDetailVisible = ref(false);
const menuDishDetailLoading = ref(false);
const menuDishDetail = ref<MenuDishDetail | null>(null);
const creatingWindow = ref(false);
const creatingDish = ref(false);
const publishingMenu = ref(false);
const adminMenuDetailVisible = ref(false);
const adminMenuDetail = ref<TodayMenu | null>(null);
const adminMenuLoading = ref(false);
const adminDishQueryId = ref<number | null>(null);
const adminDishQueryLoading = ref(false);
const adminDishDetail = ref<Dish | null>(null);
const lowStockThreshold = ref(10);
const userMenuKeyword = ref("");
const userOrderKeyword = ref("");
const merchantOrderKeyword = ref("");
const lowStockKeyword = ref("");
const dishKeyword = ref("");
const windowKeyword = ref("");
const userKeyword = ref("");
const menuKeyword = ref("");
const userOrderFilter = ref<number | "all">("all");
const adminUserPage = ref(1);
const adminUserSize = ref(10);
const adminUserTotal = ref(0);
const activeSection = ref("");
const windowForm = reactive({
  name: "",
  location: "",
  merchantId: undefined as number | undefined,
  pickupPrefix: "A"
});
const dishForm = reactive({
  id: undefined as number | undefined,
  name: "",
  description: "",
  price: 15,
  category: "主食"
});
const menuForm = reactive({
  name: "今日午餐",
  saleDate: "",
  startTime: "",
  endTime: ""
});
const menuItemMap = reactive<Record<number, { enabled: boolean; salePrice: number; stock: number }>>({});

const roleLabel = computed(() => {
  if (authStore.role === 0) return "普通用户";
  if (authStore.role === 1) return "商家";
  if (authStore.role === 2) return "管理员";
  return "未知";
});
const isUser = computed(() => authStore.role === 0);
const isMerchant = computed(() => authStore.role === 1);
const isAdmin = computed(() => authStore.role === 2);

const flatDishes = computed(() => dishes.value.filter((d) => d.status === 1));

const selectedItems = computed(() =>
  flatDishes.value
    .map((d) => ({ menuDishId: d.id, quantity: quantityMap[d.id] || 0, price: d.salePrice }))
    .filter((x) => x.quantity > 0)
);

const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0));
const totalAmount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity * item.price, 0));
const userReadyCount = computed(() => orders.value.filter((o) => o.status === 3).length);
const filteredUserOrders = computed(() =>
  (userOrderFilter.value === "all" ? orders.value : orders.value.filter((o) => o.status === userOrderFilter.value)).filter((o) => {
    const kw = userOrderKeyword.value.trim();
    if (!kw) return true;
    return (
      String(o.id).includes(kw) ||
      o.orderNo.includes(kw) ||
      (o.pickupCode || "").includes(kw) ||
      (o.pickupNo || "").includes(kw)
    );
  })
);
const merchantPendingCount = computed(() => merchantOrders.value.filter((o) => o.status <= 2).length);
const activeWindowCount = computed(() => windows.value.filter((w) => w.status === 1).length);
const publishedDishIdSet = computed(() => {
  const ids = new Set<number>();
  merchantTodayMenus.value.forEach((m) => {
    (m.dishes || []).forEach((d) => ids.add(d.dishId));
  });
  return ids;
});
const filteredMenuDishes = computed(() => {
  const kw = userMenuKeyword.value.trim();
  return flatDishes.value.filter((d) => {
    if (!kw) return true;
    return d.dishName.includes(kw) || String(d.id).includes(kw);
  });
});
const filteredMerchantOrders = computed(() => {
  const kw = merchantOrderKeyword.value.trim();
  return merchantOrders.value.filter((o) => {
    if (!kw) return true;
    return String(o.id).includes(kw) || o.orderNo.includes(kw) || (o.pickupCode || "").includes(kw);
  });
});
const filteredLowStockDishes = computed(() => {
  const kw = lowStockKeyword.value.trim();
  return lowStockDishes.value.filter((d) => {
    const hitThreshold = d.status === 1 && d.stock <= lowStockThreshold.value;
    if (!hitThreshold) return false;
    if (!kw) return true;
    return d.dishName.includes(kw) || String(d.id).includes(kw);
  });
});
const filteredMerchantDishes = computed(() => {
  const kw = dishKeyword.value.trim();
  return merchantDishes.value.filter((d) => {
    if (!kw) return true;
    return d.name.includes(kw) || String(d.id).includes(kw) || (d.category || "").includes(kw);
  });
});
const filteredWindows = computed(() => {
  const kw = windowKeyword.value.trim();
  return windows.value.filter((w) => {
    if (!kw) return true;
    return w.name.includes(kw) || w.location.includes(kw) || String(w.id).includes(kw) || String(w.merchantId).includes(kw);
  });
});
const filteredUsers = computed(() => {
  const kw = userKeyword.value.trim();
  return allUsers.value.filter((u) => {
    if (!kw) return true;
    return String(u.id).includes(kw) || u.phone.includes(kw) || u.nickname.includes(kw);
  });
});
const filteredAdminMenus = computed(() => {
  const kw = menuKeyword.value.trim();
  return adminMenus.value.filter((m) => {
    if (!kw) return true;
    return String(m.id).includes(kw) || m.name.includes(kw);
  });
});
const selectedWindowLabel = computed(() => {
  if (!selectedWindowId.value) return "未选择窗口";
  const target = windows.value.find((w) => w.id === selectedWindowId.value);
  if (!target) return `窗口ID ${selectedWindowId.value}`;
  return `${target.name}（${target.location}）`;
});
const pickedMenuItems = computed(() =>
  merchantDishes.value
    .filter((d) => menuItemMap[d.id]?.enabled)
    .map((d) => ({
      dishId: d.id,
      salePrice: Number(menuItemMap[d.id]?.salePrice || d.price),
      stock: Number(menuItemMap[d.id]?.stock || 0)
    }))
    .filter((x) => x.stock >= 0)
);

const sectionIdMap = {
  userMenu: "section-user-menu",
  userOrders: "section-user-orders",
  merchantFulfill: "section-merchant-fulfill",
  merchantPickup: "section-merchant-pickup",
  merchantStock: "section-merchant-stock",
  merchantDish: "section-merchant-dish",
  merchantMenu: "section-merchant-menu",
  adminCreateWindow: "section-admin-create-window",
  adminWindows: "section-admin-windows",
  adminUsers: "section-admin-users",
  adminMenuDetail: "section-admin-menu-detail",
  adminDishDetail: "section-admin-dish-detail"
} as const;

const roleNavItems = computed(() => {
  if (isUser.value) {
    return [
      { key: sectionIdMap.userMenu, label: "今日菜单与下单" },
      { key: sectionIdMap.userOrders, label: "我的订单" }
    ];
  }
  if (isMerchant.value) {
    return [
      { key: sectionIdMap.merchantFulfill, label: "订单履约" },
      { key: sectionIdMap.merchantPickup, label: "叫号核销" },
      { key: sectionIdMap.merchantStock, label: "库存预警" },
      { key: sectionIdMap.merchantDish, label: "菜品管理" },
      { key: sectionIdMap.merchantMenu, label: "菜单发布" }
    ];
  }
  return [
    { key: sectionIdMap.adminCreateWindow, label: "窗口创建" },
    { key: sectionIdMap.adminWindows, label: "窗口列表" },
    { key: sectionIdMap.adminUsers, label: "用户列表" },
    { key: sectionIdMap.adminMenuDetail, label: "菜单详情查询" },
    { key: sectionIdMap.adminDishDetail, label: "菜品详情查询" }
  ];
});

const loadAll = async () => {
  loading.value = true;
  try {
    const [winList, myOrders] = await Promise.all([getWindowsApi(), getMyOrdersApi()]);
    windows.value = winList.filter((w) => w.status === 1);
    if (isUser.value) {
      const menus = await getTodayMenusApi();
      dishes.value = menus.flatMap((m) => m.dishes || []);
      orders.value = myOrders;
    } else if (isMerchant.value) {
      merchantOrders.value = myOrders;
      merchantDishes.value = await getDishListApi();
      merchantTodayMenus.value = await getTodayMenusApi();
      lowStockDishes.value = merchantTodayMenus.value.flatMap((m) => m.dishes || []);
      merchantDishes.value.forEach((d) => {
        menuItemMap[d.id] = menuItemMap[d.id] || { enabled: false, salePrice: Number(d.price), stock: 50 };
      });
    } else {
      const [usersPage, usersForMerchant] = await Promise.all([
        getUserListApi(adminUserPage.value, adminUserSize.value),
        getUserListApi(1, 200)
      ]);
      adminMenus.value = await getTodayMenusApi();
      allUsers.value = usersPage.records;
      adminUserTotal.value = usersPage.total;
      merchantUsers.value = usersForMerchant.records.filter((u) => u.role === 1 && u.status === 1);
      if (!windowForm.merchantId && merchantUsers.value.length > 0) {
        windowForm.merchantId = merchantUsers.value[0].id;
      }
    }
    if (!selectedWindowId.value && windows.value.length > 0) {
      selectedWindowId.value = windows.value[0].id;
    }
    if (isMerchant.value && selectedWindowId.value) {
      await loadQueue();
    }
  } finally {
    loading.value = false;
  }
};

const submitOrder = async () => {
  if (!selectedWindowId.value) {
    ElMessage.warning("请先选择取餐窗口");
    return;
  }
  if (selectedItems.value.length === 0) {
    ElMessage.warning("请至少选择一个菜品");
    return;
  }
  submitting.value = true;
  try {
    await createOrderApi({
      windowId: selectedWindowId.value,
      remark: remark.value || undefined,
      items: selectedItems.value.map((item) => ({
        menuDishId: item.menuDishId,
        quantity: item.quantity
      }))
    });
    ElMessage.success("下单成功");
    Object.keys(quantityMap).forEach((key) => {
      quantityMap[Number(key)] = 0;
    });
    remark.value = "";
    await loadAll();
  } finally {
    submitting.value = false;
  }
};

const statusText = (status: number) => {
  if (status === 0) return "已下单";
  if (status === 1) return "已接单";
  if (status === 2) return "制作中";
  if (status === 3) return "待取餐";
  if (status === 4) return "已取餐";
  if (status === 5) return "已取消";
  return `未知(${status})`;
};

const changeStatus = async (orderId: number, action: "accept" | "cook" | "ready") => {
  await updateOrderStatusApi(orderId, action);
  ElMessage.success("操作成功");
  await loadAll();
};

const loadQueue = async () => {
  if (!selectedWindowId.value) return;
  queueList.value = await getWindowQueueApi(selectedWindowId.value);
};

const callNext = async () => {
  if (!selectedWindowId.value) {
    ElMessage.warning("请先选择窗口");
    return;
  }
  const pickupNo = await callNextApi(selectedWindowId.value);
  ElMessage.success(`已叫号：${pickupNo}`);
  await loadQueue();
};

const verifyPickup = async () => {
  if (!verifyCode.value.trim()) {
    ElMessage.warning("请输入取餐码");
    return;
  }
  await verifyPickupApi(verifyCode.value.trim());
  ElMessage.success("核销成功");
  verifyCode.value = "";
  await loadAll();
};

const searchOrderByCode = async () => {
  if (!searchPickupCode.value.trim()) {
    ElMessage.warning("请输入取餐码");
    return;
  }
  searchedOrder.value = await getOrderByPickupCodeApi(searchPickupCode.value.trim());
  ElMessage.success("查询成功");
};

const showOrderDetail = async (orderId: number) => {
  detailOrder.value = await getOrderDetailApi(orderId);
  detailVisible.value = true;
};

const cancelOrder = async (orderId: number) => {
  await cancelOrderApi(orderId);
  ElMessage.success("订单已取消");
  await loadAll();
};

const showMenuDishDetail = async (menuDishId: number) => {
  menuDishDetailLoading.value = true;
  try {
    menuDishDetail.value = await getMenuDishDetailApi(menuDishId);
    menuDishDetailVisible.value = true;
  } finally {
    menuDishDetailLoading.value = false;
  }
};

const onAdminUserPageChange = async (page: number) => {
  adminUserPage.value = page;
  await loadAll();
};

const onAdminUserSizeChange = async (size: number) => {
  adminUserSize.value = size;
  adminUserPage.value = 1;
  await loadAll();
};

const openAdminMenuDetail = async (menuId: number) => {
  adminMenuLoading.value = true;
  try {
    adminMenuDetail.value = await getMenuDetailApi(menuId);
    adminMenuDetailVisible.value = true;
  } finally {
    adminMenuLoading.value = false;
  }
};

const queryAdminDishDetail = async () => {
  if (!adminDishQueryId.value) {
    ElMessage.warning("请输入菜品ID");
    return;
  }
  adminDishQueryLoading.value = true;
  try {
    adminDishDetail.value = await getDishDetailApi(adminDishQueryId.value);
    ElMessage.success("查询成功");
  } finally {
    adminDishQueryLoading.value = false;
  }
};

const createWindow = async () => {
  if (!windowForm.name.trim()) {
    ElMessage.warning("请输入窗口名称");
    return;
  }
  if (!windowForm.location.trim()) {
    ElMessage.warning("请输入窗口位置");
    return;
  }
  if (!windowForm.merchantId) {
    ElMessage.warning("请选择商家");
    return;
  }
  if (!windowForm.pickupPrefix.trim()) {
    ElMessage.warning("请输入叫号前缀");
    return;
  }

  creatingWindow.value = true;
  try {
    await createWindowApi({
      name: windowForm.name.trim(),
      location: windowForm.location.trim(),
      merchantId: windowForm.merchantId,
      pickupPrefix: windowForm.pickupPrefix.trim().toUpperCase()
    });
    ElMessage.success("窗口创建成功");
    windowForm.name = "";
    windowForm.location = "";
    windowForm.pickupPrefix = "A";
    await loadAll();
  } finally {
    creatingWindow.value = false;
  }
};

const logout = async () => {
  authStore.logout();
  await router.push("/login");
};

const resetDishForm = () => {
  dishForm.id = undefined;
  dishForm.name = "";
  dishForm.description = "";
  dishForm.price = 15;
  dishForm.category = "主食";
};

const saveDish = async () => {
  if (!dishForm.name.trim()) {
    ElMessage.warning("请输入菜品名称");
    return;
  }
  creatingDish.value = true;
  try {
    const payload = {
      name: dishForm.name.trim(),
      description: dishForm.description.trim() || undefined,
      price: Number(dishForm.price),
      category: dishForm.category.trim() || undefined
    };
    if (dishForm.id) {
      await updateDishApi(dishForm.id, payload);
      ElMessage.success("菜品更新成功");
    } else {
      await createDishApi(payload);
      ElMessage.success("菜品创建成功");
    }
    resetDishForm();
    await loadAll();
  } finally {
    creatingDish.value = false;
  }
};

const editDish = (dish: Dish) => {
  dishForm.id = dish.id;
  dishForm.name = dish.name;
  dishForm.description = dish.description || "";
  dishForm.price = Number(dish.price);
  dishForm.category = dish.category || "";
};

const toggleDishStatus = async (dish: Dish) => {
  await updateDishStatusApi(dish.id, dish.status === 1 ? 0 : 1);
  ElMessage.success("状态已更新");
  await loadAll();
};

const removeDish = async (id: number) => {
  await deleteDishApi(id);
  ElMessage.success("菜品已删除");
  await loadAll();
};

const publishMenu = async () => {
  if (!menuForm.name.trim() || !menuForm.saleDate || !menuForm.startTime || !menuForm.endTime) {
    ElMessage.warning("请填写完整菜单信息");
    return;
  }
  if (pickedMenuItems.value.length === 0) {
    ElMessage.warning("请至少选择一个菜品入选菜单");
    return;
  }
  publishingMenu.value = true;
  try {
    await publishMenuApi({
      name: menuForm.name.trim(),
      saleDate: menuForm.saleDate,
      startTime: menuForm.startTime,
      endTime: menuForm.endTime,
      items: pickedMenuItems.value
    });
    ElMessage.success("菜单发布成功");
    await loadAll();
  } finally {
    publishingMenu.value = false;
  }
};

const roleNameByValue = (role: number) => {
  if (role === 2) return "管理员";
  if (role === 1) return "商家";
  return "普通用户";
};

const goDisplay = async () => {
  await router.push("/display");
};

const goProfile = async () => {
  await router.push("/profile");
};

onMounted(() => {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  menuForm.saleDate = now.toISOString().slice(0, 10);
  menuForm.startTime = `${hour}:00:00`;
  menuForm.endTime = `${hour}:59:59`;
  activeSection.value = roleNavItems.value[0]?.key || "";
  loadAll();
});
</script>

<style scoped>
.wrap {
  padding: 26px 22px 30px;
  max-width: 1520px;
  margin: 0 auto;
}

.hero-card {
  margin-bottom: 18px;
  background: linear-gradient(145deg, rgba(247, 251, 255, 0.95) 0%, rgba(239, 246, 255, 0.9) 100%) !important;
}

.nav-card {
  margin-bottom: 18px;
}

.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-head h1 {
  margin: 0;
  font-size: 26px;
  color: #163b8f;
}

.hero-head p {
  margin: 8px 0 0;
  color: #54647e;
}

.order-card {
  margin-top: 18px;
}

.block {
  margin-bottom: 18px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-head span {
  font-weight: 700;
  color: #1f3f8e;
}

.section-head small {
  color: #64748b;
  font-size: 12px;
}

.kpi-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.kpi-item {
  border: 1px solid #dce8fa;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 10px 12px;
}

.kpi-label {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.kpi-value {
  font-size: 24px;
  line-height: 1.3;
  color: #1e3a8a;
}

.role-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.nav-item-btn {
  min-width: 108px;
}

.summary {
  margin: 10px 0 16px;
  color: #334155;
  background: linear-gradient(140deg, #f8fbff 0%, #f3f8ff 100%);
  border: 1px solid #dbe8fc;
  border-radius: 12px;
  padding: 12px 14px;
}

.query-input {
  margin-bottom: 10px;
}

.query-input-short {
  width: 260px;
}

.query-row {
  margin-bottom: 10px;
}

.inline-form-item {
  margin-bottom: 0;
}

.tip-alert {
  margin-bottom: 10px;
}

.student-menu-card :deep(.el-card__header) {
  background: linear-gradient(90deg, #fff7ed 0%, #fffbeb 100%);
}

.queue-tag {
  margin-top: 10px;
  margin-right: 8px;
}

.verify-btn {
  margin-top: 10px;
}

.publish-btn {
  margin-top: 10px;
}

.full-btn {
  width: 100%;
}

.section-sub-title {
  margin-bottom: 8px;
  color: #475569;
  font-weight: 600;
}

.search-result {
  margin-top: 10px;
}

.pagination-wrap {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e9eff9;
}

:deep(.el-table th.el-table__cell) {
  background: #f4f8ff;
  color: #3f4f66;
}

@media (max-width: 992px) {
  .wrap {
    padding: 16px 12px 20px;
  }

  .hero-head h1 {
    font-size: 22px;
  }

  .section-head {
    flex-wrap: wrap;
  }
}
</style>
