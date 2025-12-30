import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useUserRoleStore = defineStore('role', {
    state: () => ({
        roleList: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllRole() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/roles`);
                this.roleList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchRole(roleId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/roles/${roleId}`);
                this.roleList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addRole(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/roles`, formData);
                this.roleList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editRole(roleId, formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/roles/${roleId}`, formData)
                this.roleList = response.data.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteRole(roleId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/roles/${roleId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
    }

});