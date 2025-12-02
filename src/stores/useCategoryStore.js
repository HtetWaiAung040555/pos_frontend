import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";

const api_url = API_URL;

export const useCategoryStore = defineStore('category', {
    state: () => ({
        categoryList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: null,
    }),

    actions: {
        async fetchAllCategory() {
            this.loading = true
            try {
                const response = await axios.get(`/categories`);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchCategory(categoryId) {
            this.loading = true;
            try {
                const response = await axios.get(`/categories/${categoryId}`);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addCategory(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/categories`, formData);
                this.categoryList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editCategory(formData, categoryId) {
            this.loading = true;
            try {
                const response = await axios.put(`/categories/${categoryId}`, formData);
                this.categoryList = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteCategory(categoryId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/categories/${categoryId}`);
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
        }
    }
});