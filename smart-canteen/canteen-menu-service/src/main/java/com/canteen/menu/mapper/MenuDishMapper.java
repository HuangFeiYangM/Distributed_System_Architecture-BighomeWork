package com.canteen.menu.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.canteen.menu.entity.MenuDish;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MenuDishMapper extends BaseMapper<MenuDish> {

    @Update("UPDATE menu_dish SET stock = stock - #{qty}, sold = sold + #{qty} WHERE id = #{id} AND deleted = 0 AND stock >= #{qty}")
    int deductStock(@Param("id") Long id, @Param("qty") Integer qty);

    @Update("UPDATE menu_dish SET stock = stock + #{qty}, sold = sold - #{qty} WHERE id = #{id} AND deleted = 0 AND sold >= #{qty}")
    int restoreStock(@Param("id") Long id, @Param("qty") Integer qty);
}
