import { defineStore } from "pinia";
import axios from "axios";
import { normalizeApiError } from "@/utils/NormalizeApiError";



export const useUserStore = defineStore('user', {
    state: () => ({
        users: [],
        userData: [],
        userPermission: [],
        data: [],
        token: localStorage.getItem("token") || null,
        loading: false,
        deleteLoading: false,
        error: [],
    }),

    getters: {
        isAuthenticated: (state) => !!state.token
    },

    actions: {
        async fetchAllUsers() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/users`);
                this.users = response.data.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchUser(userId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/users/${userId}`);
                this.users = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addUser(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/users`, formData);
                this.users = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editUser(formData, userId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/users/${userId}`, formData);
                this.users = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteUser(userId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/users/${userId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async loginUser(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/login`, formData);
                this.userData = JSON.stringify(response.data);
                if (response.data.isSuccess) {
                    this.token = response.data.token;
                    this.userPermission = [...response.data.user.role.permissions];
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify({
                        id: response.data.user.id,
                        name: response.data.user.name,
                        branch: response.data.user.branch,
                        counter: response.data.user.counter,
                        email: response.data.user.email,
                        permissions: [...response.data.user.role.permissions]
                    }));
                }
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async logout() {
            this.loading = true;
            try {
                const response = await axios.post(`/logout`);
                if (response.data.isSuccess) {
                    this.token = null;
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        }
    }
});