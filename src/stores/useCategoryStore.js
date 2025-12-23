import { defineStore } from "pinia";
import axios from "axios";
import { API_URL } from "@/utils/config";
import { normalizeApiError } from "@/utils/NormalizeApiError";

const api_url = API_URL;

export const useCategoryStore = defineStore('category', {
    state: () => ({
        categoryList: [],
        loading: false,
        deleteLoading: false,
        data: null,
        error: [],
    }),

    actions: {
        async fetchAllCategory() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/categories`);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchCategory(categoryId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/categories/${categoryId}`);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addCategory(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/categories`, formData);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editCategory(formData, categoryId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.put(`/categories/${categoryId}`, formData);
                this.categoryList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteCategory(categoryId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/categories/${categoryId}`);
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }
});