package com.canteen.menu.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.menu.entity.MenuDish;
import com.canteen.menu.vo.StockItemVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MenuDishMapper extends BaseMapper<MenuDish> {

    @Update("UPDATE menu_dish SET stock = stock - #{qty}, sold = sold + #{qty} WHERE id = #{id} AND deleted = 0 AND stock >= #{qty}")
    int deductStock(@Param("id") Long id, @Param("qty") Integer qty);

    @Update("UPDATE menu_dish SET stock = stock + #{qty}, sold = sold - #{qty} WHERE id = #{id} AND deleted = 0 AND sold >= #{qty}")
    int restoreStock(@Param("id") Long id, @Param("qty") Integer qty);

    @Update("UPDATE menu_dish SET stock = #{stock} WHERE id = #{id} AND deleted = 0")
    int setStock(@Param("id") Long id, @Param("stock") Integer stock);

    @Update("UPDATE menu_dish SET stock = stock + #{delta} WHERE id = #{id} AND deleted = 0")
    int increaseStock(@Param("id") Long id, @Param("delta") Integer delta);

    @Update("UPDATE menu_dish SET stock = stock - #{delta} WHERE id = #{id} AND deleted = 0 AND stock >= #{delta}")
    int decreaseStock(@Param("id") Long id, @Param("delta") Integer delta);

    @Update("""
            UPDATE menu_dish
            SET sale_price = COALESCE(#{salePrice}, sale_price),
                status = COALESCE(#{status}, status)
            WHERE id = #{id} AND deleted = 0
            """)
    int adminUpdateMenuDish(@Param("id") Long id, @Param("salePrice") java.math.BigDecimal salePrice, @Param("status") Integer status);

    @Select("""
            <script>
            SELECT
              md.id AS menuDishId,
              m.id AS menuId,
              m.name AS menuName,
              d.id AS dishId,
              d.name AS dishName,
              d.merchant_id AS merchantId,
              CONCAT('merchant-', d.merchant_id) AS merchantName,
              md.stock AS stock,
              md.sold AS sold,
              md.status AS status,
              m.sale_date AS saleDate,
              d.stock_threshold AS stockThreshold
            FROM menu_dish md
            INNER JOIN menu m ON md.menu_id = m.id AND m.deleted = 0
            INNER JOIN dish d ON md.dish_id = d.id AND d.deleted = 0
            WHERE md.deleted = 0
            <if test='merchantId != null'>
              AND d.merchant_id = #{merchantId}
            </if>
            <if test='menuId != null'>
              AND m.id = #{menuId}
            </if>
            <if test='dishId != null'>
              AND d.id = #{dishId}
            </if>
            <if test='status != null'>
              AND md.status = #{status}
            </if>
            <if test='saleDate != null and saleDate != ""'>
              AND m.sale_date = #{saleDate}
            </if>
            <if test='keyword != null and keyword != ""'>
              AND (m.name LIKE CONCAT('%', #{keyword}, '%') OR d.name LIKE CONCAT('%', #{keyword}, '%'))
            </if>
            <if test='lowStockOnly != null and lowStockOnly'>
              AND md.stock &lt;= d.stock_threshold
            </if>
            ORDER BY md.id DESC
            </script>
            """)
    Page<StockItemVO> selectStockPage(Page<StockItemVO> page,
                                      @Param("merchantId") Long merchantId,
                                      @Param("keyword") String keyword,
                                      @Param("status") Integer status,
                                      @Param("menuId") Long menuId,
                                      @Param("dishId") Long dishId,
                                      @Param("saleDate") String saleDate,
                                      @Param("lowStockOnly") Boolean lowStockOnly);
}
