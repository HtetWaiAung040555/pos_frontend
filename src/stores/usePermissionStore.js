import axios from "axios";
import { defineStore } from "pinia";

export const usePermissionStore = defineStore('permission', {
    state: () => ({
        permissionList: [],
        userPermission: [],
        loading: false,
        error: null,
    }), 
    actions: {
        loadPermission() {
            const user = JSON.parse(localStorage.getItem('user'));
            this.userPermission = user?.permissions || [];
        },
        can(module, action) {
            const user = JSON.parse(localStorage.getItem('user'));
            return user.permissions.some(
                p => p.name === module && p.action.toLowerCase() === action.toLowerCase()
            );
        },
        async fetchAllPermission() {
            this.loading = true;
            try {
                const response = await axios.get(`/permissions`);
                this.permissionList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
    }
});