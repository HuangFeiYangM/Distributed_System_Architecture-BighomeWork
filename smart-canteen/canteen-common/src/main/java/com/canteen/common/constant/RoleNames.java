package com.canteen.common.constant;

public final class RoleNames {
    public static final String USER = "USER";
    public static final String MERCHANT = "MERCHANT";
    public static final String ADMIN = "ADMIN";

    public static String fromDbRole(Integer role) {
        if (role == null) {
            return USER;
        }
        return switch (role) {
            case 1 -> MERCHANT;
            case 2 -> ADMIN;
            default -> USER;
        };
    }

    public static Integer toDbRole(String roleName) {
        if (roleName == null) {
            return 0;
        }
        return switch (roleName) {
            case MERCHANT -> 1;
            case ADMIN -> 2;
            default -> 0;
        };
    }

    private RoleNames() {}
}
