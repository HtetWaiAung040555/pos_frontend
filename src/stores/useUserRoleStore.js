import axios from "axios";
import { defineStore } from "pinia";

export const useUserRoleStore = defineStore('role', {
    state: () => ({
        roleList: [],
        loading: false,
        deleteLoading: false,
        error: null,
        data: null

    }),
    actions: {
        async fetchAllRole() {
            this.loading = true;
            try {
                const response = await axios.get(`/roles`);
                this.roleList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchRole(roleId) {
            this.loading = true;
            try {
                const response = await axios.get(`/roles/${roleId}`);
                this.roleList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addRole(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/roles`, formData);
                this.roleList = response.data.data;
            } catch(err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editRole(roleId, formData) {
            this.loading = true;
            try {
                const response = await axios.put(`/roles/${roleId}`, formData)
                this.roleList = response.data.data
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
                
            } finally {
                this.loading = false;
            }
        },
        async deleteRole(roleId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/roles/${roleId}`);
                this.data = response;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data;
                } else if (err.response && err.response.status === 400) {
                    this.error = err.response.data.error;
                } 
            } finally {
                this.deleteLoading = false;
            }
        },
        async addRolePermission(roleId, permissionId) {
            this.loading = true;
            try {
                
            } catch (err) {

            } finally {

            }
        }
    }

});